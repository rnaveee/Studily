package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.academic.ItemTypes;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.FeedImportDtos.FeedChange;
import com.rnave.studily.canvas.FeedImportDtos.StageOutcome;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseMatcher;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.ics.IcsFetcher;
import com.rnave.studily.ics.IcsParser;
import com.rnave.studily.ics.IcsParser.ParsedCalendar;
import com.rnave.studily.ics.IcsParser.ParsedEvent;
import com.rnave.studily.semester.Semester;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CanvasFeedService {

    private static final int MAX_EVENTS = 2000;
    private static final int MAX_SOURCE_CHARS = 4_000_000;

    private static final String[] COLORS = {
            "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#7968dc", "#0ea5e9"
    };

    private static final Pattern CODE_SUFFIX = Pattern.compile("^(.*?)\\s*\\[([^\\]]{1,120})\\]\\s*$");
    private final CourseRepository courseRepository;
    private final AcademicItemRepository itemRepository;
    private final CalendarEventRepository eventRepository;
    private final SemesterRepository semesterRepository;
    private final FeedIgnoredRefRepository ignoredRefRepository;
    private final CourseMatcher courseMatcher;
    private final IcsFetcher fetcher;

    Clock clock = Clock.systemDefaultZone();

    public CanvasFeedService(CourseRepository courseRepository, AcademicItemRepository itemRepository,
                             CalendarEventRepository eventRepository, SemesterRepository semesterRepository,
                             FeedIgnoredRefRepository ignoredRefRepository, CourseMatcher courseMatcher,
                             IcsFetcher fetcher) {
        this.courseRepository = courseRepository;
        this.itemRepository = itemRepository;
        this.eventRepository = eventRepository;
        this.semesterRepository = semesterRepository;
        this.ignoredRefRepository = ignoredRefRepository;
        this.courseMatcher = courseMatcher;
        this.fetcher = fetcher;
    }

    @Transactional
    public StageOutcome stage(User user, FeedRequest req) {
        String text = resolve(req.source());
        if (!text.toUpperCase(Locale.ROOT).contains("BEGIN:VCALENDAR")) {
            throw new BadRequestException("That does not look like a calendar feed from Canvas, "
                    + "Brightspace or Moodle");
        }

        ParsedCalendar parsed = IcsParser.parse(text, zoneOf(req.timeZone()), MAX_EVENTS);
        if (parsed.events().isEmpty()) {
            throw new BadRequestException("No events were found in that calendar. Make sure you copied the "
                    + "calendar feed link from your Canvas, Brightspace or Moodle calendar page.");
        }

        LmsProvider provider = LmsProvider.detect(req.source(), parsed.events());
        Semester semester = resolveSemester(user.getId(), req.semesterId());
        Staging staging = new Staging(user, semester,
                ignoredRefs(user.getId(), FeedIgnoredRef.Kind.COURSE),
                ignoredRefs(user.getId(), FeedIgnoredRef.Kind.ITEM));
        staging.skipped = parsed.skipped();

        if (provider == LmsProvider.D2L || provider == LmsProvider.MOODLE) {
            stageLms(staging, provider, parsed.events());
        } else if (stageCanvas(staging, parsed.events())) {
            provider = LmsProvider.CANVAS;
        }

        if (provider == null) {
            throw new BadRequestException("That feed has no Canvas, Brightspace or Moodle coursework in it. "
                    + "Use the calendar feed link from your school's learning system, or use "
                    + "Calendar > Import for a plain calendar.");
        }

        List<StagedCourse> courses = staging.courses.values().stream()
                .filter(c -> !c.items().isEmpty())
                .toList();
        StagedPayload payload = new StagedPayload(provider.name(),
                semester == null ? null : semester.getId(), courses);
        return new StageOutcome(payload, staging.itemsUpdated, staging.eventsImported, staging.skipped,
                parsed.truncated(), staging.changes);
    }

    private Set<String> ignoredRefs(Long userId, FeedIgnoredRef.Kind kind) {
        Set<String> refs = new HashSet<>();
        for (FeedIgnoredRef ref : ignoredRefRepository.findByUserIdAndKind(userId, kind)) {
            refs.add(ref.getRef());
        }
        return refs;
    }

    private boolean stageCanvas(Staging s, List<ParsedEvent> events) {
        boolean sawCanvasRef = false;
        for (ParsedEvent event : events) {
            CanvasRef ref = CanvasRef.parse(event.url());
            if (ref == null) {
                ref = CanvasRef.parse(event.description());
            }
            if (ref == null) {
                importPlainEvent(s, event, courseFromTitle(s, event.title()));
                continue;
            }
            sawCanvasRef = true;
            if (ref.kind() == CanvasRef.Kind.CALENDAR_EVENT) {
                stageCanvasEvent(s, event, ref);
                continue;
            }
            String uid = ref.externalUid();
            if (!s.seen.add(uid)) {
                s.skipped++;
                continue;
            }
            String title = stripCourseCode(event.title());
            AcademicItem existing = itemRepository
                    .findFirstByCourseUserIdAndExternalUidOrderByIdAsc(s.user.getId(), uid)
                    .orElse(null);
            if (existing != null) {
                eventRepository.findByUserIdAndExternalUid(s.user.getId(), externalUid(event))
                        .ifPresent(eventRepository::delete);
                noteChange(s, uid, existing.getTitle(), title, existing.getDueAt(), event.startAt(),
                        existing.getCourse());
                existing.setTitle(title);
                existing.setDueAt(event.startAt());
                itemRepository.save(existing);
                s.itemsUpdated++;
                continue;
            }
            if (s.ignoredItems.contains(uid)) {
                continue;
            }
            StagedCourse course = canvasCourse(s, ref.courseId(), event.title());
            if (course != null) {
                course.items().add(new StagedItem(uid, uid, StagedKind.ITEM, itemType(ref, title), title,
                        event.startAt(), null));
            }
        }
        return sawCanvasRef;
    }

    private void stageCanvasEvent(Staging s, ParsedEvent event, CanvasRef ref) {
        String uid = externalUid(event);
        if (!s.seen.add(uid)) {
            s.skipped++;
            return;
        }
        String title = stripCourseCode(event.title());
        CalendarEvent existing = eventRepository.findByUserIdAndExternalUid(s.user.getId(), uid).orElse(null);
        if (existing != null) {
            noteChange(s, uid, existing.getTitle(), title, existing.getStartAt(), event.startAt(),
                    existing.getCourse());
            existing.setTitle(title);
            existing.setPlace(event.place());
            existing.setStartAt(event.startAt());
            if (existing.getCourse() == null) {
                courseRepository.findByUserIdAndCanvasCourseId(s.user.getId(), ref.courseId())
                        .ifPresent(existing::setCourse);
            }
            eventRepository.save(existing);
            s.eventsUpdated++;
            return;
        }
        if (s.ignoredItems.contains(uid)) {
            return;
        }
        StagedCourse course = canvasCourse(s, ref.courseId(), event.title());
        if (course != null) {
            course.items().add(new StagedItem(uid, uid, StagedKind.EVENT, null, title, event.startAt(),
                    event.place()));
        }
    }

    private StagedCourse canvasCourse(Staging s, long canvasCourseId, String eventTitle) {
        String key = "canvas:" + canvasCourseId;
        if (s.ignoredCourses.contains(key)) {
            return null;
        }
        StagedCourse staged = s.courses.get(key);
        if (staged != null) {
            return staged;
        }
        Long semesterId = s.semester == null ? null : s.semester.getId();
        Course linked = courseRepository.findByUserIdAndCanvasCourseId(s.user.getId(), canvasCourseId).orElse(null);
        if (linked != null) {
            linked.setCanvasSyncedAt(clock.instant());
            courseRepository.save(linked);
            staged = new StagedCourse(key, canvasCourseId, null, null, linked.getName(), linked.getCode(),
                    linked.getColor(), semesterId, linked.getId(), null, new ArrayList<>());
        } else {
            CourseLabel label = CourseLabel.parse(courseCode(eventTitle));
            String name = label.name() == null ? "Canvas course " + canvasCourseId : label.name();
            Course match = courseMatcher.best(s.user.getId(), name, label.code(), semesterId, true);
            staged = new StagedCourse(key, canvasCourseId, null, null, name, label.code(),
                    COLORS[(int) Math.floorMod(canvasCourseId, COLORS.length)], semesterId, null,
                    match == null ? null : match.getId(), new ArrayList<>());
        }
        s.courses.put(key, staged);
        return staged;
    }

    private void stageLms(Staging s, LmsProvider provider, List<ParsedEvent> events) {
        List<LmsRef> refs = new ArrayList<>(events.size());
        Set<String> dueGroups = new HashSet<>();
        for (ParsedEvent event : events) {
            LmsRef ref = provider == LmsProvider.D2L ? D2lRefParser.parse(event) : MoodleRefParser.parse(event);
            refs.add(ref);
            if (ref != null && ref.kind() == LmsRef.Kind.ITEM && !ref.closing()) {
                dueGroups.add(ref.groupKey());
            }
        }

        for (int i = 0; i < events.size(); i++) {
            ParsedEvent event = events.get(i);
            LmsRef ref = refs.get(i);
            if (ref == null) {
                importPlainEvent(s, event, courseFromTitle(s, event.title()));
                continue;
            }
            if (ref.kind() == LmsRef.Kind.SKIP || (ref.closing() && dueGroups.contains(ref.groupKey()))) {
                s.skipped++;
                continue;
            }
            String uid = capUid(ref.uid());
            if (!s.seen.add(uid)) {
                s.skipped++;
                continue;
            }
            AcademicItem existing = itemRepository
                    .findFirstByCourseUserIdAndExternalUidOrderByIdAsc(s.user.getId(), uid)
                    .orElse(null);
            if (existing != null) {
                noteChange(s, uid, existing.getTitle(), ref.title(), existing.getDueAt(), event.startAt(),
                        existing.getCourse());
                existing.setTitle(ref.title());
                existing.setDueAt(event.startAt());
                itemRepository.save(existing);
                s.itemsUpdated++;
                continue;
            }
            if (s.ignoredItems.contains(uid)) {
                continue;
            }
            StagedCourse course = lmsCourse(s, provider, ref);
            if (course != null) {
                ItemType type = ref.typeHint() != null ? ref.typeHint() : ItemTypes.fromName(ref.title());
                course.items().add(new StagedItem(uid, uid, StagedKind.ITEM, type, ref.title(),
                        event.startAt(), null));
            }
        }
    }

    private StagedCourse lmsCourse(Staging s, LmsProvider provider, LmsRef ref) {
        String providerName = provider.name();
        String key = providerName + ":" + ref.courseKey();
        if (s.ignoredCourses.contains(key)) {
            return null;
        }
        StagedCourse staged = s.courses.get(key);
        if (staged != null) {
            return staged;
        }
        Long semesterId = s.semester == null ? null : s.semester.getId();
        Course linked = courseRepository
                .findByUserIdAndLmsProviderAndLmsCourseId(s.user.getId(), providerName, ref.courseKey())
                .orElse(null);
        if (linked != null) {
            staged = new StagedCourse(key, null, providerName, ref.courseKey(), linked.getName(),
                    linked.getCode(), linked.getColor(), semesterId, linked.getId(), null, new ArrayList<>());
        } else {
            String fallback = (provider == LmsProvider.D2L ? "Brightspace" : "Moodle") + " course "
                    + ref.courseKey();
            String name = ref.courseName() == null || ref.courseName().isBlank() ? fallback : ref.courseName();
            name = name.length() <= 255 ? name : name.substring(0, 255);
            Course match = courseMatcher.best(s.user.getId(), name, ref.courseCode(), semesterId, true);
            staged = new StagedCourse(key, null, providerName, ref.courseKey(), name, ref.courseCode(),
                    COLORS[Math.floorMod(ref.courseKey().hashCode(), COLORS.length)], semesterId, null,
                    match == null ? null : match.getId(), new ArrayList<>());
        }
        s.courses.put(key, staged);
        return staged;
    }

    private String capUid(String uid) {
        return uid.length() <= 200 ? uid : uid.substring(0, uid.indexOf('-') + 1) + sha256(uid);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private Course courseFromTitle(Staging s, String title) {
        String code = CourseLabel.parse(courseCode(title)).code();
        if (code == null) {
            return null;
        }
        if (s.titleCourses.containsKey(code)) {
            return s.titleCourses.get(code);
        }
        Long semesterId = s.semester == null ? null : s.semester.getId();
        Course found = courseMatcher.best(s.user.getId(), null, code, semesterId, false);
        s.titleCourses.put(code, found);
        return found;
    }

    private void importPlainEvent(Staging s, ParsedEvent event, Course course) {
        String uid = externalUid(event);
        if (!s.seen.add(uid)) {
            s.skipped++;
            return;
        }
        CalendarEvent existing = eventRepository.findByUserIdAndExternalUid(s.user.getId(), uid).orElse(null);
        if (existing == null) {
            CalendarEvent created = new CalendarEvent();
            created.setUser(s.user);
            created.setTitle(stripCourseCode(event.title()));
            created.setPlace(event.place());
            created.setStartAt(event.startAt());
            created.setCourse(course);
            created.setExternalUid(uid);
            eventRepository.save(created);
            s.eventsImported++;
            return;
        }
        existing.setTitle(stripCourseCode(event.title()));
        existing.setPlace(event.place());
        existing.setStartAt(event.startAt());
        if (course != null) {
            existing.setCourse(course);
        }
        eventRepository.save(existing);
        s.eventsUpdated++;
    }

    private static void noteChange(Staging s, String uid, String oldTitle, String title, Instant oldAt,
                                   Instant at, Course course) {
        boolean moved = !Objects.equals(oldAt, at);
        boolean renamed = !Objects.equals(oldTitle, title);
        if (!moved && !renamed) {
            return;
        }
        String label = course == null ? null
                : course.getCode() != null && !course.getCode().isBlank() ? course.getCode() : course.getName();
        s.changes.add(new FeedChange(uid, title, renamed ? oldTitle : null, label, at, moved ? oldAt : null));
    }

    private Semester resolveSemester(Long userId, Long semesterId) {
        if (semesterId != null) {
            return semesterRepository.findByIdAndUserId(semesterId, userId)
                    .orElseThrow(() -> new BadRequestException("That semester does not exist"));
        }
        LocalDate today = LocalDate.now(clock);
        return semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        userId, today, today)
                .orElse(null);
    }

    private ItemType itemType(CanvasRef ref, String title) {
        if (ref.kind() == CanvasRef.Kind.QUIZ) {
            return ItemType.EXAM;
        }
        return ItemTypes.fromName(title);
    }

    private String courseCode(String title) {
        Matcher m = CODE_SUFFIX.matcher(title);
        return m.matches() ? m.group(2).trim() : null;
    }

    private String stripCourseCode(String title) {
        Matcher m = CODE_SUFFIX.matcher(title);
        if (!m.matches()) {
            return title;
        }
        String stripped = m.group(1).trim();
        return stripped.isEmpty() ? title : stripped;
    }

    private String externalUid(ParsedEvent event) {
        String base = event.uid() == null || event.uid().isBlank()
                ? event.title() + "|" + event.startAt()
                : event.uid();
        String key = event.recurring() ? base + "#" + event.startAt().getEpochSecond() : base;
        return key.length() <= 255 ? key : key.substring(0, 255);
    }

    private String resolve(String source) {
        String trimmed = source.trim();
        if (trimmed.length() > MAX_SOURCE_CHARS) {
            throw new BadRequestException("That calendar is too large to import");
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("webcal://")) {
            return fetcher.fetch(trimmed);
        }
        return trimmed;
    }

    private ZoneId zoneOf(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(timeZone);
        } catch (RuntimeException e) {
            return ZoneId.systemDefault();
        }
    }

    private static final class Staging {
        final User user;
        final Semester semester;
        final Set<String> ignoredCourses;
        final Set<String> ignoredItems;
        final Set<String> seen = new HashSet<>();
        final Map<String, StagedCourse> courses = new LinkedHashMap<>();
        final Map<String, Course> titleCourses = new HashMap<>();
        final List<FeedChange> changes = new ArrayList<>();
        int itemsUpdated;
        int eventsImported;
        int eventsUpdated;
        int skipped;

        Staging(User user, Semester semester, Set<String> ignoredCourses, Set<String> ignoredItems) {
            this.user = user;
            this.semester = semester;
            this.ignoredCourses = ignoredCourses;
            this.ignoredItems = ignoredItems;
        }
    }
}
