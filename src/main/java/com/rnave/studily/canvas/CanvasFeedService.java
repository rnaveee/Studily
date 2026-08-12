package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.CanvasDtos.FeedResult;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.MatchKeys;
import com.rnave.studily.course.Course;
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

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
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
    private static final Pattern EXAM_TITLE =
            Pattern.compile("\\b(exam|midterm|final|test)\\b", Pattern.CASE_INSENSITIVE);

    private final CourseRepository courseRepository;
    private final AcademicItemRepository itemRepository;
    private final CalendarEventRepository eventRepository;
    private final SemesterRepository semesterRepository;
    private final IcsFetcher fetcher;
    private final CurrentUser currentUser;

    Clock clock = Clock.systemDefaultZone();

    public CanvasFeedService(CourseRepository courseRepository, AcademicItemRepository itemRepository,
                             CalendarEventRepository eventRepository, SemesterRepository semesterRepository,
                             IcsFetcher fetcher, CurrentUser currentUser) {
        this.courseRepository = courseRepository;
        this.itemRepository = itemRepository;
        this.eventRepository = eventRepository;
        this.semesterRepository = semesterRepository;
        this.fetcher = fetcher;
        this.currentUser = currentUser;
    }

    @Transactional
    public FeedResult importFeed(FeedRequest req) {
        String text = resolve(req.source());
        if (!text.toUpperCase(Locale.ROOT).contains("BEGIN:VCALENDAR")) {
            throw new BadRequestException("That does not look like a Canvas calendar feed");
        }

        ParsedCalendar parsed = IcsParser.parse(text, zoneOf(req.timeZone()), MAX_EVENTS);
        if (parsed.events().isEmpty()) {
            throw new BadRequestException("No events were found in that calendar. Make sure you copied the "
                    + "Calendar Feed link from the Canvas calendar page.");
        }

        User user = currentUser.entity();
        Semester semester = resolveSemester(user.getId(), req.semesterId());
        Counters counters = new Counters();
        counters.skipped = parsed.skipped();
        Map<Long, Course> courses = new HashMap<>();
        Set<String> seen = new HashSet<>();
        boolean sawCanvasRef = false;

        for (ParsedEvent event : parsed.events()) {
            CanvasRef ref = CanvasRef.parse(event.url());
            if (ref == null) {
                ref = CanvasRef.parse(event.description());
            }
            if (ref == null) {
                importPlainEvent(user, event, seen, counters);
                continue;
            }
            sawCanvasRef = true;
            if (ref.kind() == CanvasRef.Kind.CALENDAR_EVENT) {
                importPlainEvent(user, event, seen, counters);
                continue;
            }
            if (!seen.add(ref.externalUid())) {
                counters.skipped++;
                continue;
            }
            Course course = courses.computeIfAbsent(
                    ref.courseId(), id -> resolveCourse(user, id, event.title(), semester, counters));
            importItem(course, ref, event, counters);
        }

        if (!sawCanvasRef && !looksLikeCanvasUrl(req.source())) {
            throw new BadRequestException("That feed has no Canvas coursework in it. Use the Calendar Feed link "
                    + "from your Canvas calendar, or import it as a plain calendar instead.");
        }

        return new FeedResult(counters.coursesCreated, counters.coursesMatched, counters.itemsImported,
                counters.itemsUpdated, counters.eventsImported, counters.eventsUpdated,
                counters.skipped, parsed.truncated());
    }

    private void importItem(Course course, CanvasRef ref, ParsedEvent event, Counters counters) {
        String uid = ref.externalUid();
        String title = stripCourseCode(event.title());
        AcademicItem existing = itemRepository
                .findFirstByCourseUserIdAndExternalUidOrderByIdAsc(course.getUser().getId(), uid)
                .orElse(null);

        if (existing == null) {
            AcademicItem item = new AcademicItem();
            item.setCourse(course);
            item.setExternalUid(uid);
            item.setType(itemType(ref, title));
            item.setTitle(title);
            item.setDueAt(event.startAt());
            itemRepository.save(item);
            counters.itemsImported++;
            return;
        }

        existing.setCourse(course);
        existing.setTitle(title);
        existing.setDueAt(event.startAt());
        itemRepository.save(existing);
        counters.itemsUpdated++;
    }

    private void importPlainEvent(User user, ParsedEvent event, Set<String> seen, Counters counters) {
        String uid = externalUid(event);
        if (!seen.add(uid)) {
            counters.skipped++;
            return;
        }
        CalendarEvent existing = eventRepository.findByUserIdAndExternalUid(user.getId(), uid).orElse(null);
        if (existing == null) {
            CalendarEvent created = new CalendarEvent();
            created.setUser(user);
            created.setTitle(stripCourseCode(event.title()));
            created.setPlace(event.place());
            created.setStartAt(event.startAt());
            created.setExternalUid(uid);
            eventRepository.save(created);
            counters.eventsImported++;
            return;
        }
        existing.setTitle(stripCourseCode(event.title()));
        existing.setPlace(event.place());
        existing.setStartAt(event.startAt());
        eventRepository.save(existing);
        counters.eventsUpdated++;
    }

    private Course resolveCourse(User user, long canvasCourseId, String eventTitle,
                                 Semester semester, Counters counters) {
        Course byCanvasId = courseRepository.findByUserIdAndCanvasCourseId(user.getId(), canvasCourseId).orElse(null);
        if (byCanvasId != null) {
            counters.coursesMatched++;
            byCanvasId.setCanvasSyncedAt(clock.instant());
            return courseRepository.save(byCanvasId);
        }

        String code = courseCode(eventTitle);
        String codeKey = MatchKeys.codeKey(code);
        if (codeKey != null) {
            Course byCode = courseRepository
                    .findFirstByUserIdAndCodeKeyOrderByIdAsc(user.getId(), codeKey).orElse(null);
            if (byCode != null && byCode.getCanvasCourseId() == null) {
                byCode.setCanvasCourseId(canvasCourseId);
                byCode.setCanvasSyncedAt(clock.instant());
                counters.coursesMatched++;
                return courseRepository.save(byCode);
            }
        }

        Course course = new Course();
        course.setUser(user);
        course.setSemester(semester);
        course.setName(code == null ? "Canvas course " + canvasCourseId : code);
        course.setCode(code);
        course.setCodeKey(codeKey);
        course.setColor(COLORS[(int) Math.floorMod(canvasCourseId, COLORS.length)]);
        course.setCanvasCourseId(canvasCourseId);
        course.setCanvasSyncedAt(clock.instant());
        counters.coursesCreated++;
        return courseRepository.save(course);
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
        return EXAM_TITLE.matcher(title).find() ? ItemType.EXAM : ItemType.ASSIGNMENT;
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

    private boolean looksLikeCanvasUrl(String source) {
        String lower = source.trim().toLowerCase(Locale.ROOT);
        return lower.contains("/feeds/calendars/") || lower.contains("instructure.com");
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

    private static final class Counters {
        int coursesCreated;
        int coursesMatched;
        int itemsImported;
        int itemsUpdated;
        int eventsImported;
        int eventsUpdated;
        int skipped;
    }
}
