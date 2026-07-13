package com.rnave.studily.notification;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.course.MeetingBlock;
import com.rnave.studily.course.MeetingBlockRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ReminderSchedulerTest {

    private static final ZoneId ZONE = ZoneId.of("America/Toronto");

    private MeetingBlockRepository meetingBlockRepository;
    private CalendarEventRepository calendarEventRepository;
    private AcademicItemRepository itemRepository;
    private NotificationPrefsService prefsService;
    private NotificationDispatcher dispatcher;
    private ReminderScheduler scheduler;

    private User user;
    private Course course;

    @BeforeEach
    void setUp() {
        meetingBlockRepository = mock(MeetingBlockRepository.class);
        calendarEventRepository = mock(CalendarEventRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        prefsService = mock(NotificationPrefsService.class);
        dispatcher = mock(NotificationDispatcher.class);
        scheduler = new ReminderScheduler(meetingBlockRepository, calendarEventRepository,
                itemRepository, prefsService, dispatcher, ZONE.getId());

        user = new User();
        user.setId(1L);

        course = new Course();
        course.setId(10L);
        course.setName("CMPT 300");
        course.setUser(user);

        when(prefsService.prefsFor(1L)).thenReturn(defaultPrefs());
    }

    private NotificationPrefs defaultPrefs() {
        NotificationPrefs prefs = new NotificationPrefs();
        prefs.setUserId(1L);
        return prefs;
    }

    private void fixClockAt(ZonedDateTime time) {
        scheduler.clock = Clock.fixed(time.toInstant(), ZONE);
    }

    @Test
    void classReminderDispatchesForBlockStartingInAnHour() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 9, 30, 0, 0, ZONE);
        fixClockAt(now);

        MeetingBlock block = new MeetingBlock();
        block.setId(5L);
        block.setCourse(course);
        block.setDayOfWeek(DayOfWeek.MON);
        block.setStartTime(LocalTime.of(10, 30));
        when(meetingBlockRepository.findStartingBetween(
                eq(DayOfWeek.MON), eq(LocalTime.of(10, 30)), eq(LocalTime.of(10, 36)), any()))
                .thenReturn(List.of(block));

        scheduler.classReminders();

        verify(dispatcher).dispatch(eq(user), eq(NotificationType.CLASS_REMINDER), eq(5L),
                eq("CLASS:5:2026-07-13"), eq("Class in 1 hour"),
                contains("CMPT 300"), eq("/"));
    }

    @Test
    void classReminderSkipsWhenPrefOff() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 9, 30, 0, 0, ZONE);
        fixClockAt(now);

        NotificationPrefs prefs = defaultPrefs();
        prefs.setClassReminders(false);
        when(prefsService.prefsFor(1L)).thenReturn(prefs);

        MeetingBlock block = new MeetingBlock();
        block.setId(5L);
        block.setCourse(course);
        block.setStartTime(LocalTime.of(10, 30));
        when(meetingBlockRepository.findStartingBetween(any(), any(), any(), any()))
                .thenReturn(List.of(block));

        scheduler.classReminders();

        verifyNoInteractions(dispatcher);
    }

    @Test
    void dayOfSkipsBeforeSevenAm() {
        fixClockAt(ZonedDateTime.of(2026, 7, 13, 6, 30, 0, 0, ZONE));

        scheduler.dayOfReminders();

        verifyNoInteractions(calendarEventRepository);
        verifyNoInteractions(dispatcher);
    }

    @Test
    void dayOfDispatchesEventAndExamWithEncouragement() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 8, 0, 0, 0, ZONE);
        fixClockAt(now);

        CalendarEvent event = new CalendarEvent();
        event.setId(7L);
        event.setUser(user);
        event.setTitle("Club fair");
        event.setStartAt(now.plusHours(4).toInstant());
        when(calendarEventRepository.findByStartAtBetween(any(), any())).thenReturn(List.of(event));

        AcademicItem exam = new AcademicItem();
        exam.setId(20L);
        exam.setCourse(course);
        exam.setType(ItemType.EXAM);
        exam.setTitle("Midterm");
        exam.setDueAt(now.plusHours(6).toInstant());
        when(itemRepository.findByTypeAndStatusNotAndDueAtBetween(
                eq(ItemType.EXAM), eq(ItemStatus.DONE), any(), any())).thenReturn(List.of(exam));

        scheduler.dayOfReminders();

        verify(dispatcher).dispatch(eq(user), eq(NotificationType.EVENT_TODAY), eq(7L),
                eq("EVENT:7:2026-07-13"), eq("Today"), contains("Club fair"), eq("/calendar"));
        verify(dispatcher).dispatch(eq(user), eq(NotificationType.EXAM_TODAY), eq(20L),
                eq("EXAMDAY:20:2026-07-13"), eq("Exam today: Midterm"),
                contains("You got this"), eq("/courses/10"));
    }

    @Test
    void weekAheadDispatchesUpcomingAssignment() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 12, 0, 0, 0, ZONE);
        fixClockAt(now);

        AcademicItem item = new AcademicItem();
        item.setId(30L);
        item.setCourse(course);
        item.setType(ItemType.ASSIGNMENT);
        item.setTitle("Assignment 3");
        item.setDueAt(now.plusDays(6).toInstant());
        when(itemRepository.findByStatusNotAndDueAtBetween(eq(ItemStatus.DONE), any(), any()))
                .thenReturn(List.of(item));

        scheduler.weekAheadReminders();

        verify(dispatcher).dispatch(eq(user), eq(NotificationType.ITEM_WEEK_AHEAD), eq(30L),
                eq("ITEM7D:30"), eq("Assignment due in 6 days"),
                contains("Assignment 3"), eq("/courses/10"));
    }

    @Test
    void weekAheadSkipsExamDueTodayBecauseExamTodayCoversIt() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 12, 0, 0, 0, ZONE);
        fixClockAt(now);

        AcademicItem exam = new AcademicItem();
        exam.setId(31L);
        exam.setCourse(course);
        exam.setType(ItemType.EXAM);
        exam.setTitle("Final");
        exam.setDueAt(now.plusHours(3).toInstant());
        when(itemRepository.findByStatusNotAndDueAtBetween(eq(ItemStatus.DONE), any(), any()))
                .thenReturn(List.of(exam));

        scheduler.weekAheadReminders();

        verify(dispatcher, never()).dispatch(any(), any(), any(), any(), any(), any(), any());
    }
}
