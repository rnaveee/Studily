package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.FeedImportDtos.StageOutcome;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseMatcher;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.ics.IcsFetcher;
import com.rnave.studily.ics.IcsParser;
import com.rnave.studily.ics.IcsParser.ParsedEvent;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LmsFeedImportTest {

    private CourseRepository courseRepository;
    private AcademicItemRepository itemRepository;
    private CalendarEventRepository eventRepository;
    private FeedIgnoredRefRepository ignoredRefRepository;
    private CanvasFeedService service;
    private User user;

    @BeforeEach
    void setUp() {
        courseRepository = mock(CourseRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        eventRepository = mock(CalendarEventRepository.class);
        ignoredRefRepository = mock(FeedIgnoredRefRepository.class);
        SemesterRepository semesterRepository = mock(SemesterRepository.class);

        user = new User();
        user.setId(7L);

        when(courseRepository.findByUserIdAndLmsProviderAndLmsCourseId(anyLong(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(courseRepository.findByUserIdOrderByNameAsc(anyLong())).thenReturn(List.of());
        when(courseRepository.save(any(Course.class))).thenAnswer(inv -> inv.getArgument(0));
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(itemRepository.save(any(AcademicItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(eventRepository.findByUserIdAndExternalUid(anyLong(), anyString())).thenReturn(Optional.empty());
        when(eventRepository.save(any(CalendarEvent.class))).thenAnswer(inv -> inv.getArgument(0));
        when(semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        anyLong(), any(), any()))
                .thenReturn(Optional.empty());

        service = new CanvasFeedService(courseRepository, itemRepository, eventRepository,
                semesterRepository, ignoredRefRepository, new CourseMatcher(courseRepository),
                mock(IcsFetcher.class));
    }

    private static String fixture(String name) {
        try (InputStream in = LmsFeedImportTest.class.getResourceAsStream("/feeds/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private StageOutcome importText(String text) {
        return service.stage(user, new FeedRequest(text, "America/Vancouver", null, false));
    }

    private static List<ParsedEvent> events(String name) {
        return IcsParser.parse(fixture(name), ZoneId.of("UTC"), 100).events();
    }

    @Test
    void detect_usesTheSourceUrlBeforeTheEvents() {
        assertThat(LmsProvider.detect("https://uvic.brightspace.com/d2l/le/calendar/feed/user/feed.ics?token=x",
                List.of())).isEqualTo(LmsProvider.D2L);
        assertThat(LmsProvider.detect("webcal://school.example.edu/d2l/le/calendar/feed/user/feed.ics", List.of()))
                .isEqualTo(LmsProvider.D2L);
        assertThat(LmsProvider.detect("https://m.example.edu/calendar/export_execute.php?userid=1&authtoken=a",
                List.of())).isEqualTo(LmsProvider.MOODLE);
        assertThat(LmsProvider.detect("https://school.instructure.com/feeds/calendars/user_x.ics", List.of()))
                .isEqualTo(LmsProvider.CANVAS);
        assertThat(LmsProvider.detect("https://example.com/cal.ics", List.of())).isNull();
    }

    @Test
    void detect_fallsBackToEventLinksAndUids() {
        assertThat(LmsProvider.detect("pasted text", events("d2l.ics"))).isEqualTo(LmsProvider.D2L);
        assertThat(LmsProvider.detect("pasted text", events("moodle.ics"))).isEqualTo(LmsProvider.MOODLE);
        List<ParsedEvent> canvas = IcsParser.parse("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:e\nSUMMARY:A [B 100]\n"
                + "DTSTART:20261001T000000Z\nURL:https://x.instructure.com/courses/1/assignments/2\n"
                + "END:VEVENT\nEND:VCALENDAR\n", ZoneId.of("UTC"), 10).events();
        assertThat(LmsProvider.detect("pasted text", canvas)).isEqualTo(LmsProvider.CANVAS);
    }

    @Test
    void d2l_stagesCoursesAndItemsWithoutCreatingAnythingAndSkipsAvailabilityStarts() {
        StageOutcome outcome = importText(fixture("d2l.ics"));

        assertThat(outcome.payload().provider()).isEqualTo("D2L");
        assertThat(outcome.eventsImported()).isEqualTo(1);
        assertThat(outcome.skipped()).isEqualTo(2);
        assertThat(outcome.payload().courses()).hasSize(2);

        StagedCourse csc = outcome.payload().courses().getFirst();
        assertThat(csc.key()).isEqualTo("D2L:60614");
        assertThat(csc.lmsProvider()).isEqualTo("D2L");
        assertThat(csc.lmsCourseId()).isEqualTo("60614");
        assertThat(csc.code()).isEqualTo("CSC 225");
        assertThat(csc.name()).isEqualTo("CSC 225 A01 - Algorithms and Data Structures");
        assertThat(csc.canvasCourseId()).isNull();
        assertThat(csc.items()).extracting(StagedItem::externalUid)
                .containsExactly("d2l-60614-db41001", "d2l-60614-qi52002");
        assertThat(csc.items()).extracting(StagedItem::title).containsExactly("Assignment 1", "Midterm Quiz");
        assertThat(csc.items()).extracting(StagedItem::type)
                .containsExactly(ItemType.ASSIGNMENT, ItemType.EXAM);
        assertThat(outcome.payload().courses().get(1).items()).extracting(StagedItem::externalUid)
                .containsExactly("d2l-60790-db41007");

        verify(courseRepository, never()).save(any(Course.class));
        verify(itemRepository, never()).save(any(AcademicItem.class));
    }

    @Test
    void d2l_suggestsAHandMadeCourseWithTheSameCode() {
        Course manual = new Course();
        manual.setId(3L);
        manual.setUser(user);
        manual.setCode("CSC225");
        when(courseRepository.findByUserIdOrderByNameAsc(7L)).thenReturn(List.of(manual));

        StageOutcome outcome = importText(fixture("d2l.ics"));

        assertThat(outcome.payload().courses().getFirst().matchCourseId()).isEqualTo(3L);
        assertThat(outcome.payload().courses().get(1).matchCourseId()).isNull();
        assertThat(manual.getLmsCourseId()).isNull();
    }

    @Test
    void d2l_restageUpdatesAnAcceptedItemAndKeepsGradesAndStatus() {
        Course course = new Course();
        course.setId(3L);
        course.setUser(user);
        course.setName("Algorithms");
        course.setLmsProvider("D2L");
        course.setLmsCourseId("60614");
        when(courseRepository.findByUserIdAndLmsProviderAndLmsCourseId(7L, "D2L", "60614"))
                .thenReturn(Optional.of(course));

        AcademicItem existing = new AcademicItem();
        existing.setId(9L);
        existing.setCourse(course);
        existing.setExternalUid("d2l-60614-db41001");
        existing.setTitle("Old title");
        existing.setScore(17.0);
        existing.setStatus(ItemStatus.DONE);
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "d2l-60614-db41001"))
                .thenReturn(Optional.of(existing));

        StageOutcome outcome = importText(fixture("d2l.ics"));

        assertThat(outcome.itemsUpdated()).isEqualTo(1);
        StagedCourse linked = outcome.payload().courses().getFirst();
        assertThat(linked.linkedCourseId()).isEqualTo(3L);
        assertThat(linked.items()).extracting(StagedItem::externalUid).containsExactly("d2l-60614-qi52002");
        assertThat(existing.getTitle()).isEqualTo("Assignment 1");
        assertThat(existing.getDueAt()).isNotNull();
        assertThat(existing.getScore()).isEqualTo(17.0);
        assertThat(existing.getStatus()).isEqualTo(ItemStatus.DONE);
    }

    @Test
    void moodle_stagesCoursesFromCategoriesAndSkipsOpensEvents() {
        StageOutcome outcome = importText(fixture("moodle.ics"));

        assertThat(outcome.payload().provider()).isEqualTo("MOODLE");
        assertThat(outcome.eventsImported()).isEqualTo(1);
        assertThat(outcome.skipped()).isEqualTo(2);
        assertThat(outcome.payload().courses()).hasSize(2);

        StagedCourse chem = outcome.payload().courses().getFirst();
        assertThat(chem.key()).isEqualTo("MOODLE:CHEM121-F26");
        assertThat(chem.lmsProvider()).isEqualTo("MOODLE");
        assertThat(chem.lmsCourseId()).isEqualTo("CHEM121-F26");
        assertThat(chem.code()).isEqualTo("CHEM 121");
        assertThat(chem.items()).extracting(StagedItem::externalUid)
                .containsExactly("moodle-2482@moodle.example.edu", "moodle-2490@moodle.example.edu");
        assertThat(chem.items()).extracting(StagedItem::title).containsExactly("Lab Report 2", "Week 5 Quiz");
        assertThat(chem.items()).extracting(StagedItem::type)
                .containsExactly(ItemType.ASSIGNMENT, ItemType.EXAM);
        assertThat(outcome.payload().courses().get(1).items()).extracting(StagedItem::title)
                .containsExactly("Final Essay");

        verify(courseRepository, never()).save(any(Course.class));
        verify(itemRepository, never()).save(any(AcademicItem.class));
    }

    @Test
    void moodle_suggestsAHandMadeCourseWithTheSameCode() {
        Course manual = new Course();
        manual.setId(3L);
        manual.setUser(user);
        manual.setName("HIST 210");
        when(courseRepository.findByUserIdOrderByNameAsc(7L)).thenReturn(List.of(manual));

        StageOutcome outcome = importText(fixture("moodle.ics"));

        assertThat(outcome.payload().courses().get(1).matchCourseId()).isEqualTo(3L);
        assertThat(manual.getLmsCourseId()).isNull();
    }

    @Test
    void moodle_restageUpdatesInsteadOfStagingADuplicate() {
        AcademicItem existing = new AcademicItem();
        existing.setId(9L);
        existing.setExternalUid("moodle-2482@moodle.example.edu");
        existing.setTitle("Old");
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "moodle-2482@moodle.example.edu"))
                .thenReturn(Optional.of(existing));

        StageOutcome outcome = importText(fixture("moodle.ics"));

        assertThat(outcome.itemsUpdated()).isEqualTo(1);
        assertThat(outcome.payload().courses().stream().mapToInt(c -> c.items().size()).sum()).isEqualTo(2);
        assertThat(existing.getTitle()).isEqualTo("Lab Report 2");
    }

    @Test
    void moodle_leavesOutSkippedCoursesAndItems() {
        FeedIgnoredRef course = new FeedIgnoredRef();
        course.setKind(FeedIgnoredRef.Kind.COURSE);
        course.setRef("MOODLE:HIST210");
        FeedIgnoredRef item = new FeedIgnoredRef();
        item.setKind(FeedIgnoredRef.Kind.ITEM);
        item.setRef("moodle-2490@moodle.example.edu");
        when(ignoredRefRepository.findByUserIdAndKind(7L, FeedIgnoredRef.Kind.COURSE)).thenReturn(List.of(course));
        when(ignoredRefRepository.findByUserIdAndKind(7L, FeedIgnoredRef.Kind.ITEM)).thenReturn(List.of(item));

        StageOutcome outcome = importText(fixture("moodle.ics"));

        assertThat(outcome.payload().courses()).hasSize(1);
        assertThat(outcome.payload().courses().getFirst().items()).extracting(StagedItem::title)
                .containsExactly("Lab Report 2");
    }

    @Test
    void rejectsACalendarWithNoCourseworkAndNamesTheSupportedSchoolSystems() {
        String text = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nSUMMARY:Dentist\nDTSTART:20261001T180000Z\n"
                + "END:VEVENT\nEND:VCALENDAR\n";

        assertThatThrownBy(() -> importText(text))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Brightspace")
                .hasMessageContaining("Moodle")
                .hasMessageContaining("Calendar > Import");
        verify(itemRepository, never()).save(any());
    }

    @Test
    void sourceUrlIsEnoughEvenWhenTheFeedHasNoCoursework() {
        String text = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nSUMMARY:Dentist\nDTSTART:20261001T180000Z\n"
                + "END:VEVENT\nEND:VCALENDAR\n";
        IcsFetcher fetcher = mock(IcsFetcher.class);
        when(fetcher.fetch(anyString())).thenReturn(text);
        CanvasFeedService fetching = new CanvasFeedService(courseRepository, itemRepository, eventRepository,
                mock(SemesterRepository.class), ignoredRefRepository, new CourseMatcher(courseRepository), fetcher);

        StageOutcome outcome = fetching.stage(user, new FeedRequest(
                "https://brightspace.example.edu/d2l/le/calendar/feed/user/feed.ics?token=t", null, null, false));

        assertThat(outcome.payload().provider()).isEqualTo("D2L");
        assertThat(outcome.eventsImported()).isEqualTo(1);
        assertThat(outcome.payload().courses()).isEmpty();
    }

    @Test
    void d2l_realFeedReadsLinksFromDescriptionsAndStagesExamEvents() {
        service.clock = Clock.fixed(Instant.parse("2026-10-26T12:00:00Z"), ZoneOffset.UTC);

        StageOutcome outcome = importText(fixture("d2l-real.ics"));

        assertThat(outcome.payload().provider()).isEqualTo("D2L");
        assertThat(outcome.eventsImported()).isZero();
        assertThat(outcome.skipped()).isEqualTo(1);
        assertThat(outcome.payload().courses()).hasSize(1);

        StagedCourse biol = outcome.payload().courses().getFirst();
        assertThat(biol.key()).isEqualTo("D2L:369909");
        assertThat(biol.code()).isEqualTo("BIOL 1191");
        assertThat(biol.items()).hasSize(16);
        assertThat(biol.items()).extracting(StagedItem::externalUid)
                .contains("d2l-369909-db303026", "d2l-369909-qi502337", "d2l-369909-ev4059132",
                        "d2l-369909-ev4061487", "d2l-369909-ev4050172");
        assertThat(biol.items()).extracting(StagedItem::title)
                .contains("Nervous System worksheet (Ch 12)", "AI fact-check challenge (Ch 13)", "Quiz 2 - Ch 14")
                .doesNotContain("test time zone shift");
        assertThat(item(biol, "iClicker remote number").type()).isEqualTo(ItemType.ASSIGNMENT);
        assertThat(item(biol, "Hormone Matching").type()).isEqualTo(ItemType.ASSIGNMENT);
        assertThat(item(biol, "1191 Lab 11 Review Quiz").type()).isEqualTo(ItemType.EXAM);
        assertThat(item(biol, "Quiz #1 - Ch 12&13").type()).isEqualTo(ItemType.EXAM);
        assertThat(item(biol, "Lecture Midterm I").type()).isEqualTo(ItemType.EXAM);
        assertThat(item(biol, "Lab Final Exam").type()).isEqualTo(ItemType.EXAM);
        verify(eventRepository, never()).save(any(CalendarEvent.class));
    }

    @Test
    void d2l_recentEventWithNoCourseStillImportsAsAPlainEvent() {
        service.clock = Clock.fixed(Instant.parse("2024-12-10T12:00:00Z"), ZoneOffset.UTC);

        StageOutcome outcome = importText(fixture("d2l-real.ics"));

        assertThat(outcome.eventsImported()).isEqualTo(1);
        assertThat(outcome.skipped()).isZero();
    }

    @Test
    void d2l_removesAPlainCopyOfAnEventThatIsNowStagedAsADeadline() {
        CalendarEvent plain = new CalendarEvent();
        when(eventRepository.findByUserIdAndExternalUid(7L, "6606-4054177@brightspace.example.edu"))
                .thenReturn(Optional.of(plain));

        importText(fixture("d2l-real.ics"));

        verify(eventRepository).delete(plain);
    }

    @Test
    void detect_findsD2lFromDescriptionLinks() {
        assertThat(LmsProvider.fromEvents(events("d2l-real.ics"))).isEqualTo(LmsProvider.D2L);
    }

    private static StagedItem item(StagedCourse course, String title) {
        return course.items().stream().filter(i -> i.title().equals(title)).findFirst().orElseThrow();
    }
}
