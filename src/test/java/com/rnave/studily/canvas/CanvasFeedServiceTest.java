package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.CanvasDtos.FeedResult;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.ics.IcsFetcher;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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
    private CanvasFeedService service;

    private User user;

    @BeforeEach
    void setUp() {
        courseRepository = mock(CourseRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        eventRepository = mock(CalendarEventRepository.class);
        semesterRepository = mock(SemesterRepository.class);
        IcsFetcher fetcher = mock(IcsFetcher.class);
        CurrentUser currentUser = mock(CurrentUser.class);

        user = new User();
        user.setId(7L);
        when(currentUser.entity()).thenReturn(user);

        when(courseRepository.findByUserIdAndCanvasCourseId(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(courseRepository.findFirstByUserIdAndCodeKeyOrderByIdAsc(anyLong(), anyString()))
                .thenReturn(Optional.empty());
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
                semesterRepository, fetcher, currentUser);
    }

    private static String feed(String body) {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Canvas\r\n" + body + "END:VCALENDAR\r\n";
    }

    private static String assignment(String uid, String summary, long courseId, long itemId, String start) {
        return "BEGIN:VEVENT\r\nUID:" + uid + "\r\nSUMMARY:" + summary + "\r\nDTSTART:" + start
                + "\r\nURL:" + HOST + "/courses/" + courseId + "/assignments/" + itemId + "\r\nEND:VEVENT\r\n";
    }

    private FeedResult importText(String text) {
        return service.importFeed(new FeedRequest(text, "America/Toronto", null));
    }

    @Test
    void importFeed_createsACourseAndAnAssignmentFromACanvasEvent() {
        FeedResult result = importText(feed(
                assignment("event-assignment-55", "Problem Set 3 [CMPT 225]", 88, 55, "20261001T035900Z")));

        assertThat(result.coursesCreated()).isEqualTo(1);
        assertThat(result.itemsImported()).isEqualTo(1);

        ArgumentCaptor<Course> courses = ArgumentCaptor.forClass(Course.class);
        verify(courseRepository).save(courses.capture());
        assertThat(courses.getValue().getCanvasCourseId()).isEqualTo(88L);
        assertThat(courses.getValue().getCode()).isEqualTo("CMPT 225");
        assertThat(courses.getValue().getCodeKey()).isEqualTo("CMPT225");
        assertThat(courses.getValue().getCanvasSyncedAt()).isNotNull();

        ArgumentCaptor<AcademicItem> items = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository).save(items.capture());
        assertThat(items.getValue().getTitle()).isEqualTo("Problem Set 3");
        assertThat(items.getValue().getType()).isEqualTo(ItemType.ASSIGNMENT);
        assertThat(items.getValue().getExternalUid()).isEqualTo("canvas-assignment-55");
    }

    @Test
    void importFeed_reusesACourseAlreadyLinkedToTheSameCanvasId() {
        Course existing = new Course();
        existing.setId(3L);
        existing.setUser(user);
        existing.setCanvasCourseId(88L);
        when(courseRepository.findByUserIdAndCanvasCourseId(7L, 88L)).thenReturn(Optional.of(existing));

        FeedResult result = importText(feed(
                assignment("event-assignment-55", "Lab 1 [CMPT 225]", 88, 55, "20261001T035900Z")));

        assertThat(result.coursesCreated()).isZero();
        assertThat(result.coursesMatched()).isEqualTo(1);
    }

    @Test
    void importFeed_adoptsAManuallyCreatedCourseWithTheSameCode() {
        Course manual = new Course();
        manual.setId(3L);
        manual.setUser(user);
        manual.setCode("CMPT 225");
        manual.setCodeKey("CMPT225");
        when(courseRepository.findFirstByUserIdAndCodeKeyOrderByIdAsc(7L, "CMPT225"))
                .thenReturn(Optional.of(manual));

        FeedResult result = importText(feed(
                assignment("event-assignment-55", "Lab 1 [CMPT 225]", 88, 55, "20261001T035900Z")));

        assertThat(result.coursesCreated()).isZero();
        assertThat(result.coursesMatched()).isEqualTo(1);
        assertThat(manual.getCanvasCourseId()).isEqualTo(88L);
    }

    @Test
    void importFeed_updatesTitleAndDueDateButNeverTouchesGradesOrStatus() {
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

        FeedResult result = importText(feed(
                assignment("event-assignment-55", "Problem Set 3 [CMPT 225]", 88, 55, "20261005T035900Z")));

        assertThat(result.itemsImported()).isZero();
        assertThat(result.itemsUpdated()).isEqualTo(1);
        assertThat(existing.getTitle()).isEqualTo("Problem Set 3");
        assertThat(existing.getScore()).isEqualTo(18.0);
        assertThat(existing.getMaxScore()).isEqualTo(20.0);
        assertThat(existing.getWeight()).isEqualTo(15.0);
        assertThat(existing.getStatus()).isEqualTo(ItemStatus.DONE);
    }

    @Test
    void importFeed_treatsQuizzesAndExamTitlesAsExams() {
        importText(feed("BEGIN:VEVENT\r\nUID:event-quiz-1\r\nSUMMARY:Week 4 Quiz [CHEM 121]\r\n"
                + "DTSTART:20261001T035900Z\r\nURL:" + HOST + "/courses/2/quizzes/1\r\nEND:VEVENT\r\n"
                + assignment("event-assignment-2", "Midterm 1 [CHEM 121]", 2, 2, "20261010T035900Z")));

        ArgumentCaptor<AcademicItem> items = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository, org.mockito.Mockito.times(2)).save(items.capture());
        assertThat(items.getAllValues()).allMatch(i -> i.getType() == ItemType.EXAM);
    }

    @Test
    void importFeed_routesPersonalEventsToTheCalendarInsteadOfACourse() {
        FeedResult result = importText(feed(
                "BEGIN:VEVENT\r\nUID:personal-1\r\nSUMMARY:Study group\r\nLOCATION:Library\r\n"
                        + "DTSTART:20261001T180000Z\r\nEND:VEVENT\r\n"
                        + assignment("event-assignment-55", "Essay [ENGL 101]", 4, 55, "20261002T035900Z")));

        assertThat(result.eventsImported()).isEqualTo(1);
        assertThat(result.itemsImported()).isEqualTo(1);

        ArgumentCaptor<CalendarEvent> events = ArgumentCaptor.forClass(CalendarEvent.class);
        verify(eventRepository).save(events.capture());
        assertThat(events.getValue().getTitle()).isEqualTo("Study group");
        assertThat(events.getValue().getPlace()).isEqualTo("Library");
    }

    @Test
    void importFeed_rejectsAFeedWithNoCanvasCourseworkFromANonCanvasSource() {
        String text = feed("BEGIN:VEVENT\r\nUID:x-1\r\nSUMMARY:Dentist\r\nDTSTART:20261001T180000Z\r\nEND:VEVENT\r\n");

        assertThatThrownBy(() -> importText(text))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("no Canvas coursework");
        verify(itemRepository, never()).save(any());
    }

    @Test
    void importFeed_rejectsSomethingThatIsNotACalendar() {
        assertThatThrownBy(() -> importText("<html>Not a calendar</html>"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Canvas calendar feed");
    }
}
