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
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseMatcher;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.ics.IcsFetcher;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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

class CanvasFeedServiceTest {

    private static final String HOST = "https://school.instructure.com";

    private CourseRepository courseRepository;
    private AcademicItemRepository itemRepository;
    private CalendarEventRepository eventRepository;
    private SemesterRepository semesterRepository;
    private FeedIgnoredRefRepository ignoredRefRepository;
    private CanvasFeedService service;

    private User user;

    @BeforeEach
    void setUp() {
        courseRepository = mock(CourseRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        eventRepository = mock(CalendarEventRepository.class);
        semesterRepository = mock(SemesterRepository.class);
        ignoredRefRepository = mock(FeedIgnoredRefRepository.class);
        IcsFetcher fetcher = mock(IcsFetcher.class);

        user = new User();
        user.setId(7L);

        when(courseRepository.findByUserIdAndCanvasCourseId(anyLong(), anyLong())).thenReturn(Optional.empty());
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
                semesterRepository, ignoredRefRepository, new CourseMatcher(courseRepository), fetcher);
    }

    private static String feed(String body) {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Canvas\r\n" + body + "END:VCALENDAR\r\n";
    }

    private static String assignment(String uid, String summary, long courseId, long itemId, String start) {
        return "BEGIN:VEVENT\r\nUID:" + uid + "\r\nSUMMARY:" + summary + "\r\nDTSTART:" + start
                + "\r\nURL:" + HOST + "/courses/" + courseId + "/assignments/" + itemId + "\r\nEND:VEVENT\r\n";
    }

    private StageOutcome importText(String text) {
        return service.stage(user, new FeedRequest(text, "America/Toronto", null, false));
    }

    private static FeedIgnoredRef ignored(FeedIgnoredRef.Kind kind, String ref) {
        FeedIgnoredRef entry = new FeedIgnoredRef();
        entry.setKind(kind);
        entry.setRef(ref);
        return entry;
    }

    @Test
    void stage_splitsTheBracketIntoNameAndCodeAndCreatesNothing() {
        StageOutcome outcome = importText(feed(assignment("event-assignment-55",
                "Lab 2 [Fundamentals of Digital Logic and Design - ENSC252 D100]", 88, 55, "20261001T035900Z")));

        assertThat(outcome.payload().provider()).isEqualTo("CANVAS");
        assertThat(outcome.payload().courses()).hasSize(1);
        StagedCourse course = outcome.payload().courses().getFirst();
        assertThat(course.key()).isEqualTo("canvas:88");
        assertThat(course.canvasCourseId()).isEqualTo(88L);
        assertThat(course.name()).isEqualTo("Fundamentals of Digital Logic and Design");
        assertThat(course.code()).isEqualTo("ENSC252 D100");
        assertThat(course.linkedCourseId()).isNull();
        assertThat(course.matchCourseId()).isNull();
        assertThat(course.items()).hasSize(1);
        StagedItem item = course.items().getFirst();
        assertThat(item.key()).isEqualTo("canvas-assignment-55");
        assertThat(item.externalUid()).isEqualTo("canvas-assignment-55");
        assertThat(item.kind()).isEqualTo(StagedKind.ITEM);
        assertThat(item.type()).isEqualTo(ItemType.ASSIGNMENT);
        assertThat(item.title()).isEqualTo("Lab 2");

        verify(courseRepository, never()).save(any(Course.class));
        verify(itemRepository, never()).save(any(AcademicItem.class));
        verify(eventRepository, never()).save(any(CalendarEvent.class));
    }

    @Test
    void stage_usesTheCodeAsTheNameWhenTheBracketHasNoCourseName() {
        StageOutcome outcome = importText(feed(
                assignment("event-assignment-55", "Lab 2 [ENSC252 D100]", 88, 55, "20261001T035900Z")));

        StagedCourse course = outcome.payload().courses().getFirst();
        assertThat(course.name()).isEqualTo("ENSC252 D100");
        assertThat(course.code()).isEqualTo("ENSC252 D100");
    }

    @Test
    void stage_readsTheCalendarQueryLinksSomeCanvasFeedsUse() {
        String event = "BEGIN:VEVENT\r\nUID:event-assignment-77\r\nSUMMARY:Assignment 1 [ENSC251 E100]\r\n"
                + "DTSTART:20261001T035900Z\r\nURL:https://canvas.sfu.ca/calendar?include_contexts=course_16838"
                + "&month=10&year=2026#assignment_77\r\nEND:VEVENT\r\n";

        StageOutcome outcome = importText(feed(event));

        StagedCourse course = outcome.payload().courses().getFirst();
        assertThat(course.key()).isEqualTo("canvas:16838");
        assertThat(course.items().getFirst().externalUid()).isEqualTo("canvas-assignment-77");
    }

    @Test
    void stage_suggestsAHandMadeCourseNamedWithJustTheCode() {
        Course manual = new Course();
        manual.setId(3L);
        manual.setUser(user);
        manual.setName("ENSC252");
        when(courseRepository.findByUserIdOrderByNameAsc(7L)).thenReturn(List.of(manual));

        StageOutcome outcome = importText(feed(assignment("event-assignment-55",
                "Lab 2 [Fundamentals of Digital Logic and Design - ENSC252 D100]", 88, 55, "20261001T035900Z")));

        assertThat(outcome.payload().courses().getFirst().matchCourseId()).isEqualTo(3L);
        assertThat(manual.getCanvasCourseId()).isNull();
    }

    @Test
    void stage_neverSuggestsACourseLinkedToADifferentCanvasCourse() {
        Course other = new Course();
        other.setId(3L);
        other.setUser(user);
        other.setCode("ENSC 252");
        other.setCanvasCourseId(1L);
        when(courseRepository.findByUserIdOrderByNameAsc(7L)).thenReturn(List.of(other));

        StageOutcome outcome = importText(feed(
                assignment("event-assignment-55", "Lab 2 [ENSC252 D100]", 88, 55, "20261001T035900Z")));

        assertThat(outcome.payload().courses().getFirst().matchCourseId()).isNull();
    }

    @Test
    void stage_marksACourseAlreadyLinkedToTheSameCanvasIdAndStillStagesItsNewItems() {
        Course existing = new Course();
        existing.setId(3L);
        existing.setUser(user);
        existing.setName("Algorithms");
        existing.setCanvasCourseId(88L);
        when(courseRepository.findByUserIdAndCanvasCourseId(7L, 88L)).thenReturn(Optional.of(existing));

        StageOutcome outcome = importText(feed(
                assignment("event-assignment-55", "Lab 1 [CMPT 225]", 88, 55, "20261001T035900Z")));

        StagedCourse course = outcome.payload().courses().getFirst();
        assertThat(course.linkedCourseId()).isEqualTo(3L);
        assertThat(course.name()).isEqualTo("Algorithms");
        assertThat(course.items()).hasSize(1);
        assertThat(existing.getCanvasSyncedAt()).isNotNull();
    }

    @Test
    void stage_updatesAnAcceptedItemInPlaceAndNeverTouchesGradesOrStatus() {
        Course course = new Course();
        course.setId(3L);
        course.setUser(user);
        course.setCanvasCourseId(88L);
        when(courseRepository.findByUserIdAndCanvasCourseId(7L, 88L)).thenReturn(Optional.of(course));

        AcademicItem existing = new AcademicItem();
        existing.setId(9L);
        existing.setCourse(course);
        existing.setExternalUid("canvas-assignment-55");
        existing.setTitle("Old title");
        existing.setScore(18.0);
        existing.setMaxScore(20.0);
        existing.setWeight(15.0);
        existing.setStatus(ItemStatus.DONE);
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "canvas-assignment-55"))
                .thenReturn(Optional.of(existing));

        StageOutcome outcome = importText(feed(
                assignment("event-assignment-55", "Problem Set 3 [CMPT 225]", 88, 55, "20261005T035900Z")));

        assertThat(outcome.payload().courses()).isEmpty();
        assertThat(outcome.itemsUpdated()).isEqualTo(1);
        assertThat(existing.getTitle()).isEqualTo("Problem Set 3");
        assertThat(existing.getScore()).isEqualTo(18.0);
        assertThat(existing.getMaxScore()).isEqualTo(20.0);
        assertThat(existing.getWeight()).isEqualTo(15.0);
        assertThat(existing.getStatus()).isEqualTo(ItemStatus.DONE);
    }

    @Test
    void stage_reportsAMovedDeadlineButNotAnUnchangedOne() {
        Course course = new Course();
        course.setId(3L);
        course.setUser(user);
        course.setCode("CMPT 225");
        course.setCanvasCourseId(88L);
        when(courseRepository.findByUserIdAndCanvasCourseId(7L, 88L)).thenReturn(Optional.of(course));

        AcademicItem moved = new AcademicItem();
        moved.setCourse(course);
        moved.setExternalUid("canvas-assignment-55");
        moved.setTitle("Problem Set 3");
        moved.setDueAt(java.time.Instant.parse("2026-10-04T03:59:00Z"));
        AcademicItem same = new AcademicItem();
        same.setCourse(course);
        same.setExternalUid("canvas-assignment-56");
        same.setTitle("Problem Set 4");
        same.setDueAt(java.time.Instant.parse("2026-10-12T03:59:00Z"));
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "canvas-assignment-55"))
                .thenReturn(Optional.of(moved));
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "canvas-assignment-56"))
                .thenReturn(Optional.of(same));

        StageOutcome outcome = importText(feed(
                assignment("event-assignment-55", "Problem Set 3 [CMPT 225]", 88, 55, "20261005T035900Z")
                        + assignment("event-assignment-56", "Problem Set 4 [CMPT 225]", 88, 56, "20261012T035900Z")));

        assertThat(outcome.changes()).singleElement().satisfies(c -> {
            assertThat(c.title()).isEqualTo("Problem Set 3");
            assertThat(c.course()).isEqualTo("CMPT 225");
            assertThat(c.previousAt()).isEqualTo(java.time.Instant.parse("2026-10-04T03:59:00Z"));
            assertThat(c.at()).isEqualTo(java.time.Instant.parse("2026-10-05T03:59:00Z"));
            assertThat(c.previousTitle()).isNull();
        });
    }

    @Test
    void stage_leavesOutSkippedCoursesAndSkippedItems() {
        when(ignoredRefRepository.findByUserIdAndKind(7L, FeedIgnoredRef.Kind.COURSE))
                .thenReturn(List.of(ignored(FeedIgnoredRef.Kind.COURSE, "canvas:88")));
        when(ignoredRefRepository.findByUserIdAndKind(7L, FeedIgnoredRef.Kind.ITEM))
                .thenReturn(List.of(ignored(FeedIgnoredRef.Kind.ITEM, "canvas-assignment-2")));

        StageOutcome outcome = importText(feed(
                assignment("event-assignment-1", "Lab 1 [CMPT 225]", 88, 1, "20261001T035900Z")
                        + assignment("event-assignment-2", "Essay [ENGL 101]", 4, 2, "20261002T035900Z")
                        + assignment("event-assignment-3", "Quiz prep [ENGL 101]", 4, 3, "20261003T035900Z")));

        assertThat(outcome.payload().courses()).hasSize(1);
        StagedCourse english = outcome.payload().courses().getFirst();
        assertThat(english.key()).isEqualTo("canvas:4");
        assertThat(english.items()).extracting(StagedItem::key).containsExactly("canvas-assignment-3");
    }

    @Test
    void stage_treatsQuizzesAndExamTitlesAsExams() {
        StageOutcome outcome = importText(feed(
                "BEGIN:VEVENT\r\nUID:event-quiz-1\r\nSUMMARY:Week 4 Quiz [CHEM 121]\r\n"
                        + "DTSTART:20261001T035900Z\r\nURL:" + HOST + "/courses/2/quizzes/1\r\nEND:VEVENT\r\n"
                        + assignment("event-assignment-2", "Midterm 1 [CHEM 121]", 2, 2, "20261010T035900Z")));

        assertThat(outcome.payload().courses().getFirst().items())
                .extracting(StagedItem::type).containsExactly(ItemType.EXAM, ItemType.EXAM);
    }

    @Test
    void stage_importsPersonalEventsDirectlyBecauseTheyHaveNoCourse() {
        StageOutcome outcome = importText(feed(
                "BEGIN:VEVENT\r\nUID:personal-1\r\nSUMMARY:Study group\r\nLOCATION:Library\r\n"
                        + "DTSTART:20261001T180000Z\r\nEND:VEVENT\r\n"
                        + assignment("event-assignment-55", "Essay [ENGL 101]", 4, 55, "20261002T035900Z")));

        assertThat(outcome.eventsImported()).isEqualTo(1);
        assertThat(outcome.payload().courses()).hasSize(1);

        ArgumentCaptor<CalendarEvent> events = ArgumentCaptor.forClass(CalendarEvent.class);
        verify(eventRepository).save(events.capture());
        assertThat(events.getValue().getTitle()).isEqualTo("Study group");
        assertThat(events.getValue().getPlace()).isEqualTo("Library");
    }

    @Test
    void stage_holdsACourseCalendarEventForReviewUnderItsCourse() {
        String lecture = "BEGIN:VEVENT\r\nUID:event-calendar-event-9\r\nSUMMARY:Office hours [CMPT 225]\r\n"
                + "DTSTART:20261003T180000Z\r\nLOCATION:ASB 10900\r\nURL:" + HOST
                + "/courses/88/calendar_events/9\r\nEND:VEVENT\r\n";

        StageOutcome outcome = importText(feed(
                assignment("event-assignment-55", "Problem Set 3 [CMPT 225]", 88, 55, "20261001T035900Z")
                        + lecture));

        assertThat(outcome.eventsImported()).isZero();
        StagedCourse course = outcome.payload().courses().getFirst();
        assertThat(course.items()).extracting(StagedItem::kind)
                .containsExactly(StagedKind.ITEM, StagedKind.EVENT);
        StagedItem event = course.items().get(1);
        assertThat(event.title()).isEqualTo("Office hours");
        assertThat(event.place()).isEqualTo("ASB 10900");
        verify(eventRepository, never()).save(any(CalendarEvent.class));
    }

    @Test
    void stage_tiesAnEventWithoutALinkToAnExistingCourseByItsCodeInTheTitle() {
        Course existing = new Course();
        existing.setId(5L);
        existing.setName("Algorithms");
        existing.setCode("CMPT 225");
        when(courseRepository.findByUserIdOrderByNameAsc(7L)).thenReturn(List.of(existing));
        String plain = "BEGIN:VEVENT\r\nUID:plain-1\r\nSUMMARY:Review session [CMPT 225]\r\n"
                + "DTSTART:20261004T180000Z\r\nEND:VEVENT\r\n";

        importText(feed(assignment("event-assignment-55", "Problem Set 3 [ENGL 101]", 4, 55, "20261001T035900Z")
                + plain));

        ArgumentCaptor<CalendarEvent> events = ArgumentCaptor.forClass(CalendarEvent.class);
        verify(eventRepository).save(events.capture());
        assertThat(events.getValue().getTitle()).isEqualTo("Review session");
        assertThat(events.getValue().getCourse()).isSameAs(existing);
    }

    @Test
    void stage_rejectsAFeedWithNoCanvasCourseworkFromANonCanvasSource() {
        String text = feed("BEGIN:VEVENT\r\nUID:x-1\r\nSUMMARY:Dentist\r\nDTSTART:20261001T180000Z\r\nEND:VEVENT\r\n");

        assertThatThrownBy(() -> importText(text))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("no Canvas, Brightspace or Moodle coursework");
        verify(itemRepository, never()).save(any());
    }

    @Test
    void stage_rejectsSomethingThatIsNotACalendar() {
        assertThatThrownBy(() -> importText("<html>Not a calendar</html>"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("calendar feed from Canvas");
    }
}
