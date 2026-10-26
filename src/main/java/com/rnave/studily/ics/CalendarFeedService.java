package com.rnave.studily.ics;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.ics.IcsDtos.FeedLinkCreated;
import com.rnave.studily.ics.IcsDtos.FeedLinkStatus;
import com.rnave.studily.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class CalendarFeedService {

    static final String PUBLIC_PATH = "/api/public/calendar/";
    private static final Duration TOUCH_INTERVAL = Duration.ofMinutes(10);

    private final CalendarFeedTokenRepository repository;
    private final UserRepository userRepository;
    private final IcsService icsService;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final String baseUrl;
    private final SecureRandom random = new SecureRandom();

    public CalendarFeedService(CalendarFeedTokenRepository repository, UserRepository userRepository,
                               IcsService icsService, CurrentUser currentUser, Clock clock,
                               @Value("${app.base-url}") String baseUrl) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.icsService = icsService;
        this.currentUser = currentUser;
        this.clock = clock;
        this.baseUrl = baseUrl.trim().replaceAll("/+$", "");
    }

    @Transactional
    public FeedLinkCreated createOrRotate() {
        Long userId = currentUser.id();
        Instant now = clock.instant();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        CalendarFeedToken token = repository.findById(userId).orElseGet(() -> {
            CalendarFeedToken created = new CalendarFeedToken();
            created.setUserId(userId);
            return created;
        });
        token.setTokenHash(hash(raw));
        token.setCreatedAt(now);
        token.setLastFetchedAt(null);
        repository.save(token);

        String httpsUrl = baseUrl + PUBLIC_PATH + raw + ".ics";
        String webcalUrl = "webcal" + httpsUrl.substring(httpsUrl.indexOf("://"));
        return new FeedLinkCreated(httpsUrl, webcalUrl, now);
    }

    @Transactional(readOnly = true)
    public FeedLinkStatus status() {
        return repository.findById(currentUser.id())
                .map(t -> new FeedLinkStatus(true, t.getCreatedAt(), t.getLastFetchedAt()))
                .orElse(new FeedLinkStatus(false, null, null));
    }

    @Transactional
    public void delete() {
        repository.deleteById(currentUser.id());
    }

    @Transactional
    public Optional<String> feed(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 128) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        return repository.findByTokenHash(hash(rawToken.trim()))
                .flatMap(token -> userRepository.findById(token.getUserId()))
                .filter(user -> !user.isSuspendedAt(now))
                .map(user -> {
                    repository.touch(user.getId(), now, now.minus(TOUCH_INTERVAL));
                    return icsService.exportFor(user.getId());
                });
    }

    static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
