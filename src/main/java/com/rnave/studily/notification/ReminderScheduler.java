package com.rnave.studily.notification;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.course.MeetingBlock;
import com.rnave.studily.course.MeetingBlockRepository;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserTimeZones;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

@Component
public class ReminderScheduler {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("EEE, MMM d");
    private static final int CLASS_LEAD_MINUTES = 15;
    private static final int CLASS_WINDOW_MINUTES = 2;
    private static final int DAY_OF_START_HOUR = 7;

    private final MeetingBlockRepository meetingBlockRepository;
    private final CalendarEventRepository calendarEventRepository;
    private final AcademicItemRepository itemRepository;
    private final NotificationPrefsService prefsService;
    private final NotificationDispatcher dispatcher;
    private final UserTimeZones timeZones;
    Clock clock;

    public ReminderScheduler(MeetingBlockRepository meetingBlockRepository,
                             CalendarEventRepository calendarEventRepository,
                             AcademicItemRepository itemRepository,
                             NotificationPrefsService prefsService,
                             NotificationDispatcher dispatcher,
                             UserTimeZones timeZones) {
        this.meetingBlockRepository = meetingBlockRepository;
        this.calendarEventRepository = calendarEventRepository;
        this.itemRepository = itemRepository;
        this.prefsService = prefsService;
        this.dispatcher = dispatcher;
        this.timeZones = timeZones;
        this.clock = Clock.system(timeZones.fallback());
    }

    private Set<ZoneId> zones() {
        return timeZones.zonesInUse();
    }

    private boolean livesIn(User user, ZoneId zone) {
        return timeZones.zoneFor(user).equals(zone);
    }

    @Scheduled(fixedRate = 60_000, initialDelay = 20_000)
    @Transactional(readOnly = true)
    public void classReminders() {
        Instant now = clock.instant();
        for (ZoneId zone : zones()) {
            ZonedDateTime target = now.atZone(zone).plusMinutes(CLASS_LEAD_MINUTES);
            LocalTime from = target.toLocalTime();
            LocalTime to = from.plusMinutes(CLASS_WINDOW_MINUTES);
            if (to.isBefore(from)) {
                to = LocalTime.MAX;
            }
            LocalDate date = target.toLocalDate();
            var day = com.rnave.studily.course.DayOfWeek.valueOf(
                    target.getDayOfWeek().name().substring(0, 3));

            List<MeetingBlock> blocks = meetingBlockRepository.findStartingBetween(day, from, to, date);
            for (MeetingBlock block : blocks) {
                User user = block.getCourse().getUser();
                if (!livesIn(user, zone) || !prefsService.prefsFor(user.getId()).isClassReminders()) {
                    continue;
                }
                dispatcher.dispatch(user, NotificationType.CLASS_REMINDER, block.getId(),
                        "CLASS:%d:%s".formatted(block.getId(), date),
                        "Class in 15 minutes",
                        "%s starts at %s".formatted(
                                block.getCourse().getName(), TIME_FMT.format(block.getStartTime())),
                        "/dashboard");
            }
        }
    }

    @Scheduled(fixedRate = 600_000, initialDelay = 40_000)
    @Transactional(readOnly = true)
    public void dayOfReminders() {
        Instant instant = clock.instant();
        for (ZoneId zone : zones()) {
            ZonedDateTime now = instant.atZone(zone);
            if (now.getHour() < DAY_OF_START_HOUR) {
                continue;
            }
            LocalDate today = now.toLocalDate();
            Instant endOfDay = today.plusDays(1).atStartOfDay(zone).toInstant();

            for (CalendarEvent event : calendarEventRepository.findByStartAtBetween(instant, endOfDay)) {
                User user = event.getUser();
                if (!livesIn(user, zone) || !prefsService.prefsFor(user.getId()).isEventDayOf()) {
                    continue;
                }
                String time = TIME_FMT.format(event.getStartAt().atZone(zone));
                String body = event.getPlace() == null || event.getPlace().isBlank()
                        ? "%s at %s".formatted(event.getTitle(), time)
                        : "%s at %s · %s".formatted(event.getTitle(), time, event.getPlace());
                dispatcher.dispatch(user, NotificationType.EVENT_TODAY, event.getId(),
                        "EVENT:%d:%s".formatted(event.getId(), today),
                        "Today", body, "/calendar");
            }

            for (AcademicItem exam : itemRepository.findByTypeAndStatusNotAndDueAtBetween(
                    ItemType.EXAM, ItemStatus.DONE, instant, endOfDay)) {
                User user = exam.getCourse().getUser();
                if (!livesIn(user, zone) || !prefsService.prefsFor(user.getId()).isExamDayOf()) {
                    continue;
                }
                dispatcher.dispatch(user, NotificationType.EXAM_TODAY, exam.getId(),
                        "EXAMDAY:%d:%s".formatted(exam.getId(), today),
                        "Exam today: " + exam.getTitle(),
                        "%s at %s. You got this! 💪".formatted(
                                exam.getCourse().getName(),
                                TIME_FMT.format(exam.getDueAt().atZone(zone))),
                        "/courses/" + exam.getCourse().getId());
            }
        }
    }

    @Scheduled(fixedRate = 1_800_000, initialDelay = 60_000)
    @Transactional(readOnly = true)
    public void weekAheadReminders() {
        Instant instant = clock.instant();
        for (ZoneId zone : zones()) {
            ZonedDateTime now = instant.atZone(zone);
            LocalDate today = now.toLocalDate();
            Instant until = today.plusDays(8).atStartOfDay(zone).toInstant();

            for (AcademicItem item : itemRepository.findByStatusNotAndDueAtBetween(
                    ItemStatus.DONE, instant, until)) {
                User user = item.getCourse().getUser();
                if (!livesIn(user, zone) || !prefsService.prefsFor(user.getId()).isItemWeekAhead()) {
                    continue;
                }
                ZonedDateTime due = item.getDueAt().atZone(zone);
                long days = ChronoUnit.DAYS.between(today, due.toLocalDate());
                if (days == 0 && item.getType() == ItemType.EXAM) {
                    continue;
                }
                String kind = item.getType() == ItemType.EXAM ? "Exam" : "Assignment";
                String when = switch ((int) days) {
                    case 0 -> "due today";
                    case 1 -> "due tomorrow";
                    default -> "due in " + days + " days";
                };
                dispatcher.dispatch(user, NotificationType.ITEM_WEEK_AHEAD, item.getId(),
                        "ITEM7D:" + item.getId(),
                        "%s %s".formatted(kind, when),
                        "%s · %s · %s at %s".formatted(
                                item.getTitle(), item.getCourse().getName(),
                                DATE_FMT.format(due), TIME_FMT.format(due)),
                        "/courses/" + item.getCourse().getId());
            }
        }
    }
}
