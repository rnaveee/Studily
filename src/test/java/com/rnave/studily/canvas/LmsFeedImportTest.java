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
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.ics.IcsFetcher;
import com.rnave.studily.ics.IcsParser;
import com.rnave.studily.ics.IcsParser.ParsedEvent;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LmsFeedImportTest {

    private CourseRepository courseRepository;
    private AcademicItemRepository itemRepository;
    private CalendarEventRepository eventRepository;
    private CanvasFeedService service;
    private User user;

    @BeforeEach
    void setUp() {
        courseRepository = mock(CourseRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        eventRepository = mock(CalendarEventRepository.class);
        SemesterRepository semesterRepository = mock(SemesterRepository.class);

        user = new User();
        user.setId(7L);

        when(courseRepository.findByUserIdAndLmsProviderAndLmsCourseId(anyLong(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(courseRepository.findFirstByUserIdAndCodeKeyOrderByIdAsc(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(courseRepository.save(any(Course.class))).thenAnswer(inv -> {
            Course c = inv.getArgument(0);
            if (c.getUser() == null) {
                c.setUser(user);
            }
            return c;
        });
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
                semesterRepository, mock(IcsFetcher.class));
    }

    private static String fixture(String name) {
        try (InputStream in = LmsFeedImportTest.class.getResourceAsStream("/feeds/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private FeedResult importText(String text) {
        return service.importFeed(user, new FeedRequest(text, "America/Vancouver", null));
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
    void d2l_createsCoursesAndItemsAndSkipsAvailabilityStarts() {
        FeedResult result = importText(fixture("d2l.ics"));

        assertThat(result.provider()).isEqualTo("D2L");
        assertThat(result.coursesCreated()).isEqualTo(2);
        assertThat(result.itemsImported()).isEqualTo(3);
        assertThat(result.eventsImported()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(2);

        ArgumentCaptor<Course> courses = ArgumentCaptor.forClass(Course.class);
        verify(courseRepository, times(2)).save(courses.capture());
        Course csc = courses.getAllValues().getFirst();
        assertThat(csc.getLmsProvider()).isEqualTo("D2L");
        assertThat(csc.getLmsCourseId()).isEqualTo("60614");
        assertThat(csc.getCode()).isEqualTo("CSC 225");
        assertThat(csc.getCodeKey()).isEqualTo("CSC225");
        assertThat(csc.getName()).isEqualTo("CSC 225 A01 - Algorithms and Data Structures");
        assertThat(csc.getCanvasCourseId()).isNull();

        ArgumentCaptor<AcademicItem> items = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository, times(3)).save(items.capture());
        assertThat(items.getAllValues()).extracting(AcademicItem::getExternalUid)
                .containsExactly("d2l-60614-db41001", "d2l-60614-qi52002", "d2l-60790-db41007");
        assertThat(items.getAllValues()).extracting(AcademicItem::getTitle)
                .containsExactly("Assignment 1", "Midterm Quiz", "Reading Reflection");
        assertThat(items.getAllValues()).extracting(AcademicItem::getType)
                .containsExactly(ItemType.ASSIGNMENT, ItemType.EXAM, ItemType.ASSIGNMENT);
    }

    @Test
    void d2l_adoptsAHandMadeCourseWithTheSameCode() {
        Course manual = new Course();
        manual.setId(3L);
        manual.setUser(user);
        manual.setCode("CSC 225");
        manual.setCodeKey("CSC225");
        when(courseRepository.findFirstByUserIdAndCodeKeyOrderByIdAsc(7L, "CSC225"))
                .thenReturn(Optional.of(manual));

        FeedResult result = importText(fixture("d2l.ics"));

        assertThat(result.coursesCreated()).isEqualTo(1);
        assertThat(result.coursesMatched()).isEqualTo(1);
        assertThat(manual.getLmsProvider()).isEqualTo("D2L");
        assertThat(manual.getLmsCourseId()).isEqualTo("60614");
    }

    @Test
    void d2l_reimportUpdatesTheItemAndKeepsGradesAndStatus() {
        Course course = new Course();
        course.setId(3L);
        course.setUser(user);
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

        FeedResult result = importText(fixture("d2l.ics"));

        assertThat(result.coursesMatched()).isEqualTo(1);
        assertThat(result.itemsUpdated()).isEqualTo(1);
        assertThat(result.itemsImported()).isEqualTo(2);
        assertThat(existing.getTitle()).isEqualTo("Assignment 1");
        assertThat(existing.getDueAt()).isNotNull();
        assertThat(existing.getScore()).isEqualTo(17.0);
        assertThat(existing.getStatus()).isEqualTo(ItemStatus.DONE);
    }

    @Test
    void moodle_createsCoursesFromCategoriesAndSkipsOpensEvents() {
        FeedResult result = importText(fixture("moodle.ics"));

        assertThat(result.provider()).isEqualTo("MOODLE");
        assertThat(result.coursesCreated()).isEqualTo(2);
        assertThat(result.itemsImported()).isEqualTo(3);
        assertThat(result.eventsImported()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(2);

        ArgumentCaptor<Course> courses = ArgumentCaptor.forClass(Course.class);
        verify(courseRepository, times(2)).save(courses.capture());
        Course chem = courses.getAllValues().getFirst();
        assertThat(chem.getLmsProvider()).isEqualTo("MOODLE");
        assertThat(chem.getLmsCourseId()).isEqualTo("CHEM121-F26");
        assertThat(chem.getCode()).isEqualTo("CHEM 121");
        assertThat(chem.getCodeKey()).isEqualTo("CHEM121");

        ArgumentCaptor<AcademicItem> items = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository, times(3)).save(items.capture());
        assertThat(items.getAllValues()).extracting(AcademicItem::getExternalUid)
                .containsExactly("moodle-2482@moodle.example.edu", "moodle-2490@moodle.example.edu",
                        "moodle-2500@moodle.example.edu");
        assertThat(items.getAllValues()).extracting(AcademicItem::getTitle)
                .containsExactly("Lab Report 2", "Week 5 Quiz", "Final Essay");
        assertThat(items.getAllValues()).extracting(AcademicItem::getType)
                .containsExactly(ItemType.ASSIGNMENT, ItemType.EXAM, ItemType.EXAM);
    }

    @Test
    void moodle_adoptsAHandMadeCourseWithTheSameCode() {
        Course manual = new Course();
        manual.setId(3L);
        manual.setUser(user);
        manual.setCodeKey("HIST210");
        when(courseRepository.findFirstByUserIdAndCodeKeyOrderByIdAsc(7L, "HIST210"))
                .thenReturn(Optional.of(manual));

        FeedResult result = importText(fixture("moodle.ics"));

        assertThat(result.coursesCreated()).isEqualTo(1);
        assertThat(result.coursesMatched()).isEqualTo(1);
        assertThat(manual.getLmsCourseId()).isEqualTo("HIST210");
    }

    @Test
    void moodle_reimportUpdatesInsteadOfDuplicating() {
        AcademicItem existing = new AcademicItem();
        existing.setId(9L);
        existing.setExternalUid("moodle-2482@moodle.example.edu");
        existing.setTitle("Old");
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "moodle-2482@moodle.example.edu"))
                .thenReturn(Optional.of(existing));

        FeedResult result = importText(fixture("moodle.ics"));

        assertThat(result.itemsUpdated()).isEqualTo(1);
        assertThat(result.itemsImported()).isEqualTo(2);
        assertThat(existing.getTitle()).isEqualTo("Lab Report 2");
    }

    @Test
    void moodle_usesTheCloseDateOnlyWhenThereIsNoDueDate() {
        String text = fixture("moodle.ics");
        FeedResult result = importText(text);
        assertThat(result.itemsImported()).isEqualTo(3);
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
                mock(SemesterRepository.class), fetcher);

        FeedResult result = fetching.importFeed(user, new FeedRequest(
                "https://brightspace.example.edu/d2l/le/calendar/feed/user/feed.ics?token=t", null, null));

        assertThat(result.provider()).isEqualTo("D2L");
        assertThat(result.eventsImported()).isEqualTo(1);
    }
}
