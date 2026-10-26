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
import com.rnave.studily.exam.ExamService;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
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
import static org.mockito.Mockito.times;
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
    private UserRepository userRepository;
    private ExamService examService;
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
        userRepository = mock(UserRepository.class);
        examService = mock(ExamService.class);
        when(userRepository.findDistinctTimezones()).thenReturn(List.of());
        scheduler = new ReminderScheduler(meetingBlockRepository, calendarEventRepository,
                itemRepository, prefsService, dispatcher,
                new UserTimeZones(userRepository, ZONE.getId()), examService);

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
    void classReminderDispatchesFifteenMinutesBeforeStart() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 10, 15, 0, 0, ZONE);
        fixClockAt(now);

        MeetingBlock block = new MeetingBlock();
        block.setId(5L);
        block.setCourse(course);
        block.setDayOfWeek(DayOfWeek.MON);
        block.setStartTime(LocalTime.of(10, 30));
        when(meetingBlockRepository.findStartingBetween(
                eq(DayOfWeek.MON), eq(LocalTime.of(10, 30)), eq(LocalTime.of(10, 32)), any()))
                .thenReturn(List.of(block));

        scheduler.classReminders();

        verify(dispatcher).dispatch(eq(user), eq(NotificationType.CLASS_REMINDER), eq(5L),
                eq("CLASS:5:2026-07-13"), eq("Class in 15 minutes"),
                contains("CMPT 300"), eq("/dashboard"));
    }

    @Test
    void classReminderUsesTheOwnersTimeZoneNotTheServerDefault() {
        user.setTimezone("America/Edmonton");
        when(userRepository.findDistinctTimezones()).thenReturn(List.of("America/Edmonton"));
        scheduler = new ReminderScheduler(meetingBlockRepository, calendarEventRepository,
                itemRepository, prefsService, dispatcher,
                new UserTimeZones(userRepository, ZONE.getId()), examService);

        MeetingBlock block = new MeetingBlock();
        block.setId(5L);
        block.setCourse(course);
        block.setDayOfWeek(DayOfWeek.MON);
        block.setStartTime(LocalTime.of(10, 30));
        when(meetingBlockRepository.findStartingBetween(
                eq(DayOfWeek.MON), eq(LocalTime.of(10, 30)), eq(LocalTime.of(10, 32)), any()))
                .thenReturn(List.of(block));

        fixClockAt(ZonedDateTime.of(2026, 7, 13, 10, 15, 0, 0, ZONE));
        scheduler.classReminders();
        verify(dispatcher, never()).dispatch(any(), any(), any(), any(), any(), any(), any());

        fixClockAt(ZonedDateTime.of(2026, 7, 13, 12, 15, 0, 0, ZONE));
        scheduler.classReminders();
        verify(dispatcher).dispatch(eq(user), eq(NotificationType.CLASS_REMINDER), eq(5L),
                eq("CLASS:5:2026-07-13"), eq("Class in 15 minutes"),
                contains("CMPT 300"), eq("/dashboard"));
    }

    @Test
    void classReminderIgnoresBlocksBelongingToAnotherZone() {
        when(userRepository.findDistinctTimezones()).thenReturn(List.of("America/Edmonton"));
        scheduler = new ReminderScheduler(meetingBlockRepository, calendarEventRepository,
                itemRepository, prefsService, dispatcher,
                new UserTimeZones(userRepository, ZONE.getId()), examService);
        fixClockAt(ZonedDateTime.of(2026, 7, 13, 10, 15, 0, 0, ZONE));

        MeetingBlock block = new MeetingBlock();
        block.setId(5L);
        block.setCourse(course);
        block.setDayOfWeek(DayOfWeek.MON);
        block.setStartTime(LocalTime.of(10, 30));
        when(meetingBlockRepository.findStartingBetween(any(), any(), any(), any()))
                .thenReturn(List.of(block));

        scheduler.classReminders();

        verify(dispatcher, times(1)).dispatch(eq(user), eq(NotificationType.CLASS_REMINDER), eq(5L),
                any(), any(), any(), any());
    }

    @Test
    void classReminderSkipsWhenPrefOff() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 10, 15, 0, 0, ZONE);
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

    private AcademicItem examInDays(long id, ZonedDateTime now, int days) {
        AcademicItem exam = new AcademicItem();
        exam.setId(id);
        exam.setCourse(course);
        exam.setType(ItemType.EXAM);
        exam.setTitle("Midterm");
        exam.setDueAt(now.toLocalDate().plusDays(days).atTime(14, 0).atZone(ZONE).toInstant());
        when(itemRepository.findByTypeAndStatusNotAndDueAtBetween(
                eq(ItemType.EXAM), eq(ItemStatus.DONE), any(), any())).thenReturn(List.of(exam));
        return exam;
    }

    @Test
    void examCountdownSendsAtSevenThreeAndOneDays() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 8, 30, 0, 0, ZONE);
        fixClockAt(now);

        for (int days : new int[] {7, 3, 1}) {
            examInDays(40L + days, now, days);
            scheduler.examCountdownReminders();
        }

        verify(dispatcher).dispatch(eq(user), eq(NotificationType.EXAM_COUNTDOWN), eq(47L),
                eq("EXAMCD:47:7"), eq("Midterm in 7 days"), contains("CMPT 300"), eq("/courses/10"));
        verify(dispatcher).dispatch(eq(user), eq(NotificationType.EXAM_COUNTDOWN), eq(43L),
                eq("EXAMCD:43:3"), eq("Midterm in 3 days"), contains("CMPT 300"), eq("/courses/10"));
        verify(dispatcher).dispatch(eq(user), eq(NotificationType.EXAM_COUNTDOWN), eq(41L),
                eq("EXAMCD:41:1"), eq("Midterm in 1 day"), contains("CMPT 300"), eq("/courses/10"));
    }

    @Test
    void examCountdownIgnoresOtherDayCounts() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 9, 0, 0, 0, ZONE);
        fixClockAt(now);

        for (int days : new int[] {0, 2, 4, 5, 6}) {
            examInDays(50L + days, now, days);
            scheduler.examCountdownReminders();
        }

        verify(dispatcher, never()).dispatch(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void examCountdownWaitsUntilEightAm() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 7, 45, 0, 0, ZONE);
        fixClockAt(now);
        examInDays(60L, now, 3);

        scheduler.examCountdownReminders();

        verifyNoInteractions(dispatcher);
    }

    @Test
    void examCountdownSkipsWhenPrefOff() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 9, 0, 0, 0, ZONE);
        fixClockAt(now);
        examInDays(61L, now, 3);
        NotificationPrefs prefs = defaultPrefs();
        prefs.setExamCountdown(false);
        when(prefsService.prefsFor(1L)).thenReturn(prefs);

        scheduler.examCountdownReminders();

        verifyNoInteractions(dispatcher);
    }

    @Test
    void examCountdownReusesTheSameDedupKeyOnEveryRun() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 9, 0, 0, 0, ZONE);
        fixClockAt(now);
        examInDays(62L, now, 3);

        scheduler.examCountdownReminders();
        fixClockAt(now.plusMinutes(30));
        scheduler.examCountdownReminders();

        verify(dispatcher, times(2)).dispatch(eq(user), eq(NotificationType.EXAM_COUNTDOWN), eq(62L),
                eq("EXAMCD:62:3"), any(), any(), any());
    }

    @Test
    void examCountdownMentionsTodaysPlanWhenOneExists() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 9, 0, 0, 0, ZONE);
        fixClockAt(now);
        AcademicItem exam = examInDays(63L, now, 3);
        when(examService.todayTarget(eq(exam), any(), any())).thenReturn("Today's plan: review 12 cards.");

        scheduler.examCountdownReminders();

        verify(dispatcher).dispatch(eq(user), eq(NotificationType.EXAM_COUNTDOWN), eq(63L),
                eq("EXAMCD:63:3"), eq("Midterm in 3 days"), contains("review 12 cards"), eq("/courses/10"));
    }

    @Test
    void examCountdownUsesTheOwnersTimeZone() {
        user.setTimezone("America/Edmonton");
        when(userRepository.findDistinctTimezones()).thenReturn(List.of("America/Edmonton"));
        scheduler = new ReminderScheduler(meetingBlockRepository, calendarEventRepository,
                itemRepository, prefsService, dispatcher,
                new UserTimeZones(userRepository, ZONE.getId()), examService);

        ZonedDateTime early = ZonedDateTime.of(2026, 7, 13, 8, 30, 0, 0, ZONE);
        fixClockAt(early);
        examInDays(64L, early, 3);
        scheduler.examCountdownReminders();
        verify(dispatcher, never()).dispatch(any(), any(), any(), any(), any(), any(), any());

        fixClockAt(early.plusHours(2));
        scheduler.examCountdownReminders();
        verify(dispatcher).dispatch(eq(user), eq(NotificationType.EXAM_COUNTDOWN), eq(64L),
                eq("EXAMCD:64:3"), any(), any(), any());
    }

    @Test
    void weekAheadLeavesExamsToTheCountdownWhenItIsOn() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 13, 12, 0, 0, 0, ZONE);
        fixClockAt(now);
        AcademicItem exam = new AcademicItem();
        exam.setId(65L);
        exam.setCourse(course);
        exam.setType(ItemType.EXAM);
        exam.setTitle("Final");
        exam.setDueAt(now.plusDays(5).toInstant());
        when(itemRepository.findByStatusNotAndDueAtBetween(eq(ItemStatus.DONE), any(), any()))
                .thenReturn(List.of(exam));

        scheduler.weekAheadReminders();

        verify(dispatcher, never()).dispatch(any(), any(), any(), any(), any(), any(), any());
    }
}
