package com.rnave.studily.canvas;

import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.FeedImportDtos.FeedChange;
import com.rnave.studily.canvas.FeedImportDtos.FeedStageResult;
import com.rnave.studily.canvas.FeedImportDtos.StageOutcome;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.canvas.FeedImportDtos.StoredImport;
import com.rnave.studily.canvas.SchoolFeedDtos.SchoolFeedList;
import com.rnave.studily.canvas.SchoolFeedDtos.SchoolFeedView;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.ics.IcsDtos.AddedEvent;
import com.rnave.studily.ics.IcsDtos.ImportResult;
import com.rnave.studily.ics.IcsDtos.SyncResult;
import com.rnave.studily.ics.IcsService;
import com.rnave.studily.config.DeadLinkException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.notification.NotificationDispatcher;
import com.rnave.studily.notification.NotificationType;
import com.rnave.studily.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class SchoolFeedService {

    private static final Logger log = LoggerFactory.getLogger(SchoolFeedService.class);
    static final int MAX_FEEDS_PER_USER = 5;
    public static final String CALENDAR_PROVIDER = "ICS";
    static final int MAX_FAILURES = 5;
    static final int BATCH_SIZE = 20;
    static final long SYNC_NOW_WINDOW_MS = Duration.ofMinutes(5).toMillis();
    static final String DEAD_LINK_MESSAGE = "The link no longer works. It may have expired or been reset.";
    static final String GENERIC_ERROR = "Sync failed. We will try again later.";

    private final SchoolFeedRepository repository;
    private final FeedUrlCipher cipher;
    private final CanvasFeedService canvasFeedService;
    private final FeedImportStore importStore;
    private final NotificationDispatcher dispatcher;
    private final IcsService icsService;
    private final Clock clock;
    private final Duration staleAfter;
    private final SlidingWindowRateLimiter syncNowLimiter = new SlidingWindowRateLimiter(1, SYNC_NOW_WINDOW_MS);

    public SchoolFeedService(SchoolFeedRepository repository, FeedUrlCipher cipher,
                             CanvasFeedService canvasFeedService, FeedImportStore importStore,
                             NotificationDispatcher dispatcher, IcsService icsService, Clock clock,
                             @Value("${app.feeds.stale-after-hours:6}") long staleAfterHours) {
        this.icsService = icsService;
        this.repository = repository;
        this.cipher = cipher;
        this.canvasFeedService = canvasFeedService;
        this.importStore = importStore;
        this.dispatcher = dispatcher;
        this.clock = clock;
        this.staleAfter = Duration.ofHours(staleAfterHours);
    }

    public boolean isAvailable() {
        return cipher.isEnabled();
    }

    @Transactional(readOnly = true)
    public SchoolFeedList list(User user) {
        List<SchoolFeedView> feeds = repository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .map(SchoolFeedService::view)
                .toList();
        return new SchoolFeedList(cipher.isEnabled(), feeds);
    }

    @Transactional
    public Long remember(User user, FeedRequest req, String provider) {
        if (!cipher.isEnabled() || Boolean.FALSE.equals(req.keepSynced()) || !isRemoteSource(req.source())) {
            return null;
        }
        String url = normalise(req.source());
        String hash = sha256(url);
        Instant now = clock.instant();
        SchoolFeed feed = repository.findByUserIdAndUrlHash(user.getId(), hash).orElse(null);
        if (feed == null) {
            if (repository.countByUserId(user.getId()) >= MAX_FEEDS_PER_USER) {
                log.info("User {} is at the saved school feed limit", user.getId());
                return null;
            }
            feed = new SchoolFeed();
            feed.setUser(user);
            feed.setUrlHash(hash);
            feed.setCreatedAt(now);
        }
        feed.setUrlCiphertext(cipher.encrypt(url));
        feed.setHost(hostOf(url));
        feed.setProvider(provider);
        feed.setTimeZone(req.timeZone());
        feed.setSemesterId(req.semesterId());
        feed.setLastSyncedAt(now);
        feed.setLastSuccessAt(now);
        feed.setLastError(null);
        feed.setFailureCount(0);
        feed.setEnabled(true);
        return repository.save(feed).getId();
    }

    public FeedStageResult syncNow(User user, Long id) {
        SchoolFeed feed = repository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new NotFoundException("Saved feed not found"));
        if (!cipher.isEnabled()) {
            throw new BadRequestException("Automatic syncing is not available right now");
        }
        if (!feed.isEnabled()) {
            throw new BadRequestException("Syncing is stopped for this link. Paste it again to restart.");
        }
        if (!syncNowLimiter.tryConsume("feed:" + feed.getId())) {
            throw new TooManyRequestsException("You just synced this link. Try again in a few minutes.");
        }
        try {
            return sync(feed);
        } catch (BadRequestException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new BadRequestException(GENERIC_ERROR);
        }
    }

    @Transactional
    public void delete(User user, Long id) {
        SchoolFeed feed = repository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new NotFoundException("Saved feed not found"));
        repository.delete(feed);
    }

    public List<Long> dueFeedIds() {
        return repository.findDueIds(clock.instant().minus(staleAfter), PageRequest.of(0, BATCH_SIZE));
    }

    public void syncDue(Long feedId) {
        SchoolFeed feed = repository.findById(feedId).orElse(null);
        if (feed == null || !feed.isEnabled() || !cipher.isEnabled()) {
            return;
        }
        Instant now = clock.instant();
        if (feed.getUser().isSuspendedAt(now)) {
            feed.setLastSyncedAt(now);
            repository.save(feed);
            return;
        }
        sync(feed);
    }

    private FeedStageResult sync(SchoolFeed feed) {
        if (CALENDAR_PROVIDER.equals(feed.getProvider())) {
            return syncCalendar(feed);
        }
        Instant now = clock.instant();
        StoredImport stored;
        StageOutcome outcome;
        try {
            String url = cipher.decrypt(feed.getUrlCiphertext());
            outcome = canvasFeedService.stage(feed.getUser(),
                    new FeedRequest(url, feed.getTimeZone(), feed.getSemesterId(), false));
            stored = importStore.save(feed.getUser(), feed.getId(), outcome);
            feed.setLastSyncedAt(now);
            feed.setLastSuccessAt(now);
            feed.setFailureCount(0);
            feed.setLastError(null);
            if (stored.result().provider() != null) {
                feed.setProvider(stored.result().provider());
            }
            repository.save(feed);
        } catch (RuntimeException e) {
            recordFailure(feed, e, now);
            throw e;
        }
        announce(feed, stored);
        announceChanges(feed, outcome.changes(), stored.payload().provider());
        return stored.result();
    }

    private FeedStageResult syncCalendar(SchoolFeed feed) {
        Instant now = clock.instant();
        SyncResult result;
        String url;
        try {
            url = cipher.decrypt(feed.getUrlCiphertext());
            result = icsService.sync(feed.getUser(), icsService.fetchText(url), feed.getTimeZone(), feed.getId(),
                    icsService.isPublicGoogleFeed(url));
            feed.setLastSyncedAt(now);
            feed.setLastSuccessAt(now);
            feed.setFailureCount(0);
            feed.setLastError(null);
            repository.save(feed);
        } catch (RuntimeException e) {
            recordFailure(feed, e, now);
            throw e;
        }
        announceCalendar(feed, result);
        ImportResult r = result.result();
        return new FeedStageResult(null, CALENDAR_PROVIDER, 0, 0, r.updated(), r.imported(), r.truncated());
    }

    private void announceCalendar(SchoolFeed feed, SyncResult result) {
        int removed = result.result().removed();
        if (result.added().isEmpty() && result.changes().isEmpty() && removed == 0) {
            return;
        }
        try {
            ZoneId zone = zoneOf(feed.getTimeZone());
            List<String> keys = new ArrayList<>();
            result.added().forEach(a -> keys.add("+" + a.title() + "@" + a.at()));
            result.changes().forEach(c -> keys.add(c.uid() + "@" + c.at() + "#" + c.title()));
            keys.add("-" + removed);
            keys.sort(null);
            String label = calendarLabel(feed.getHost());
            dispatcher.dispatch(feed.getUser(), NotificationType.FEED_UPDATE, feed.getId(),
                    "feed-update:" + feed.getId() + ":" + sha256(String.join("|", keys)).substring(0, 12),
                    label + " updated", describeCalendar(result.added(), result.changes(), removed, zone),
                    "/calendar");
        } catch (RuntimeException e) {
            log.warn("Could not notify user {} about calendar changes: {}", feed.getUser().getId(),
                    e.getClass().getSimpleName());
        }
    }

    static String calendarLabel(String host) {
        return host != null && host.toLowerCase(Locale.ROOT).endsWith("calendar.google.com")
                ? "Google Calendar" : "Your calendar";
    }

    static String describeCalendar(List<AddedEvent> added, List<FeedChange> changes, int removed, ZoneId zone) {
        DateTimeFormatter when = DateTimeFormatter.ofPattern("EEE MMM d, h:mm a", Locale.ENGLISH).withZone(zone);
        List<String> parts = new ArrayList<>();
        if (!added.isEmpty()) {
            List<String> names = new ArrayList<>();
            for (AddedEvent a : added.subList(0, Math.min(added.size(), 2))) {
                names.add(a.title() + " (" + when.format(a.at()) + ")");
            }
            String more = added.size() > 2 ? " and " + (added.size() - 2) + " more" : "";
            parts.add((added.size() == 1 ? "New event: " : added.size() + " new events: ")
                    + String.join(", ", names) + more);
        }
        for (FeedChange c : changes.subList(0, Math.min(changes.size(), 2))) {
            parts.add(c.previousAt() != null
                    ? c.title() + " moved to " + when.format(c.at())
                    : c.previousTitle() + " was renamed to " + c.title());
        }
        if (changes.size() > 2) {
            parts.add((changes.size() - 2) + " more changed");
        }
        if (removed > 0) {
            parts.add(removed == 1 ? "1 event removed" : removed + " events removed");
        }
        String text = String.join(". ", parts) + ".";
        return text.length() <= 255 ? text : text.substring(0, 252) + "...";
    }

    private void announce(SchoolFeed feed, StoredImport stored) {
        Long importId = stored.result().importId();
        if (importId == null) {
            return;
        }
        try {
            String label = providerLabel(stored.payload().provider());
            dispatcher.dispatch(feed.getUser(), NotificationType.FEED_REVIEW, importId,
                    "feed-review:" + feed.getId() + ":" + fingerprint(stored.payload()),
                    headline(stored.payload(), label), announcement(stored.payload(), label),
                    "/imports/" + importId);
        } catch (RuntimeException e) {
            log.warn("Could not notify user {} about feed import {}: {}", feed.getUser().getId(), importId,
                    e.getClass().getSimpleName());
        }
    }

    private void announceChanges(SchoolFeed feed, List<FeedChange> changes, String provider) {
        if (changes == null || changes.isEmpty()) {
            return;
        }
        try {
            String label = providerLabel(provider);
            ZoneId zone = zoneOf(feed.getTimeZone());
            List<String> keys = new ArrayList<>();
            for (FeedChange c : changes) {
                keys.add(c.uid() + "@" + c.at() + "#" + c.title());
            }
            keys.sort(null);
            dispatcher.dispatch(feed.getUser(), NotificationType.FEED_UPDATE, feed.getId(),
                    "feed-update:" + feed.getId() + ":" + sha256(String.join("|", keys)).substring(0, 12),
                    changes.size() == 1 ? "A deadline changed on " + label
                            : changes.size() + " deadlines changed on " + label,
                    describeChanges(changes, zone), "/calendar");
        } catch (RuntimeException e) {
            log.warn("Could not notify user {} about feed changes: {}", feed.getUser().getId(),
                    e.getClass().getSimpleName());
        }
    }

    static String describeChanges(List<FeedChange> changes, ZoneId zone) {
        DateTimeFormatter when = DateTimeFormatter.ofPattern("EEE MMM d, h:mm a", Locale.ENGLISH).withZone(zone);
        List<String> lines = new ArrayList<>();
        for (FeedChange c : changes.subList(0, Math.min(changes.size(), 3))) {
            String name = c.course() == null ? c.title() : c.title() + " (" + c.course() + ")";
            if (c.previousAt() != null) {
                lines.add(name + " is now due " + when.format(c.at()));
            } else {
                lines.add(c.previousTitle() + " was renamed to " + name);
            }
        }
        String text = String.join(". ", lines) + ".";
        if (changes.size() > 3) {
            text += " And " + (changes.size() - 3) + " more.";
        }
        return text.length() <= 255 ? text : text.substring(0, 252) + "...";
    }

    private static ZoneId zoneOf(String timeZone) {
        try {
            return timeZone == null || timeZone.isBlank() ? ZoneId.systemDefault() : ZoneId.of(timeZone);
        } catch (RuntimeException e) {
            return ZoneId.systemDefault();
        }
    }

    static String providerLabel(String provider) {
        if ("D2L".equals(provider)) {
            return "Brightspace";
        }
        return "MOODLE".equals(provider) ? "Moodle" : "Canvas";
    }

    static String headline(StagedPayload payload, String label) {
        boolean courses = payload.courses().stream().anyMatch(c -> c.linkedCourseId() == null);
        boolean items = payload.courses().stream().anyMatch(c -> !c.items().isEmpty());
        if (courses && items) {
            return "New courses and deadlines from " + label;
        }
        return (courses ? "New courses from " : "New deadlines from ") + label;
    }

    static String announcement(StagedPayload payload, String label) {
        long courses = payload.courses().stream().filter(c -> c.linkedCourseId() == null).count();
        int items = payload.courses().stream().mapToInt(c -> c.items().size()).sum();
        if (courses == 0 && items > 0 && items <= 2) {
            List<String> names = new ArrayList<>();
            for (StagedCourse course : payload.courses()) {
                String code = course.code() != null ? course.code() : course.name();
                course.items().forEach(item -> names.add(item.title() + " (" + code + ")"));
            }
            return String.join(" and ", names) + (items == 1 ? " was" : " were") + " added on " + label
                    + ". Tap to review before it shows up in Studily.";
        }
        List<String> parts = new ArrayList<>();
        if (courses > 0) {
            parts.add(courses + (courses == 1 ? " new course" : " new courses"));
        }
        if (items > 0) {
            parts.add(items + (items == 1 ? " new deadline" : " new deadlines"));
        }
        return String.join(" and ", parts) + " from " + label + ". Tap to review before anything is added.";
    }

    static String fingerprint(StagedPayload payload) {
        List<String> keys = new ArrayList<>();
        for (StagedCourse course : payload.courses()) {
            keys.add(course.key());
            course.items().forEach(item -> keys.add(course.key() + "/" + item.key()));
        }
        keys.sort(null);
        return sha256(String.join("|", keys)).substring(0, 12);
    }

    private void recordFailure(SchoolFeed feed, RuntimeException e, Instant now) {
        feed.setLastSyncedAt(now);
        feed.setFailureCount(feed.getFailureCount() + 1);
        if (e instanceof DeadLinkException) {
            feed.setEnabled(false);
            feed.setLastError(DEAD_LINK_MESSAGE);
        } else {
            String reason = e instanceof BadRequestException ? e.getMessage() : GENERIC_ERROR;
            if (feed.getFailureCount() >= MAX_FAILURES) {
                feed.setEnabled(false);
                reason = "It failed " + MAX_FAILURES + " times in a row. " + reason;
            }
            feed.setLastError(truncate(reason, 200));
        }
        repository.save(feed);
        log.warn("School feed {} on {} failed ({}), failures={}, enabled={}", feed.getId(), feed.getHost(),
                e.getClass().getSimpleName(), feed.getFailureCount(), feed.isEnabled());
    }

    private static SchoolFeedView view(SchoolFeed feed) {
        return new SchoolFeedView(feed.getId(), feed.getProvider(), feed.getHost(), feed.getLastSyncedAt(),
                feed.getLastSuccessAt(), feed.getLastError(), feed.isEnabled());
    }

    static boolean isRemoteSource(String source) {
        String lower = source.trim().toLowerCase(Locale.ROOT);
        return lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("webcal://");
    }

    static String normalise(String source) {
        String trimmed = source.trim();
        if (trimmed.toLowerCase(Locale.ROOT).startsWith("webcal://")) {
            trimmed = "https://" + trimmed.substring("webcal://".length());
        }
        try {
            URI uri = URI.create(trimmed);
            if (uri.getScheme() == null || uri.getRawAuthority() == null) {
                return trimmed;
            }
            StringBuilder out = new StringBuilder(uri.getScheme().toLowerCase(Locale.ROOT))
                    .append("://").append(uri.getRawAuthority().toLowerCase(Locale.ROOT));
            if (uri.getRawPath() != null) {
                out.append(uri.getRawPath());
            }
            if (uri.getRawQuery() != null) {
                out.append('?').append(uri.getRawQuery());
            }
            return out.toString();
        } catch (RuntimeException e) {
            return trimmed;
        }
    }

    static String hostOf(String url) {
        try {
            String host = URI.create(url).getHost();
            return host == null ? "unknown" : truncate(host.toLowerCase(Locale.ROOT), 255);
        } catch (RuntimeException e) {
            return "unknown";
        }
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
