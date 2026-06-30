package com.rnave.studily.dashboard;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.course.MeetingBlock;
import com.rnave.studily.dashboard.DashboardDtos.DayColumn;
import com.rnave.studily.dashboard.DashboardDtos.ScheduledMeeting;
import com.rnave.studily.dashboard.DashboardDtos.WeekView;
import com.rnave.studily.semester.SemesterDtos.SemesterDto;
import com.rnave.studily.semester.SemesterService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private static final ZoneOffset ZONE = ZoneOffset.UTC;

    private final CourseRepository courseRepository;
    private final AcademicItemRepository itemRepository;
    private final SemesterService semesterService;
    private final CurrentUser currentUser;

    public DashboardService(CourseRepository courseRepository, AcademicItemRepository itemRepository,
                            @Lazy SemesterService semesterService, CurrentUser currentUser) {
        this.courseRepository = courseRepository;
        this.itemRepository = itemRepository;
        this.semesterService = semesterService;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public WeekView week(LocalDate anchor, Long semesterId) {
        Long userId = currentUser.id();
        LocalDate date = anchor != null ? anchor : LocalDate.now(ZONE);

        SemesterDto semester = null;
        if (semesterId != null) {
            semester = semesterService.get(semesterId);
        } else {
            semester = semesterService.current().orElse(null);
            if (semester != null) semesterId = semester.id();
        }

        int daysFromSunday = date.getDayOfWeek().getValue() % 7;
        LocalDate weekStart = date.minusDays(daysFromSunday);
        LocalDate weekEnd = weekStart.plusDays(6);
        Instant weekStartInstant = weekStart.atStartOfDay(ZONE).toInstant();
        Instant weekEndInstant = weekStart.plusDays(7).atStartOfDay(ZONE).toInstant();

        List<Course> courses = semesterId != null
                ? courseRepository.findByUserIdAndSemesterIdOrderByNameAsc(userId, semesterId)
                : courseRepository.findByUserIdOrderByNameAsc(userId);

        Map<Integer, List<ScheduledMeeting>> meetingsByDay = new HashMap<>();
        for (Course course : courses) {
            for (MeetingBlock mb : course.getMeetingBlocks()) {
                ScheduledMeeting sm = new ScheduledMeeting(
                        course.getId(), course.getName(), course.getCode(), course.getProfessor(),
                        course.getColor(), mb.getDayOfWeek(), mb.getStartTime(), mb.getEndTime());
                meetingsByDay.computeIfAbsent(dayIndex(mb.getDayOfWeek()), k -> new ArrayList<>()).add(sm);
            }
        }

        List<AcademicItem> weekItems = semesterId != null
                ? itemRepository.findByCourseUserIdAndCourseSemesterIdAndDueAtBetweenOrderByDueAtAsc(
                        userId, semesterId, weekStartInstant, weekEndInstant)
                : itemRepository.findByCourseUserIdAndDueAtBetweenOrderByDueAtAsc(
                        userId, weekStartInstant, weekEndInstant);

        Map<Integer, List<AcademicItemDto>> itemsByDay = weekItems.stream().collect(Collectors.groupingBy(
                i -> (int) ChronoUnit.DAYS.between(weekStart, i.getDueAt().atZone(ZONE).toLocalDate()),
                Collectors.mapping(AcademicItemDto::from, Collectors.toList())));

        List<DayColumn> days = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            LocalDate day = weekStart.plusDays(i);
            List<ScheduledMeeting> meetings = meetingsByDay.getOrDefault(i, List.of()).stream()
                    .sorted(Comparator.comparing(ScheduledMeeting::startTime))
                    .toList();
            days.add(new DayColumn(day, dayOfWeekForIndex(i), meetings,
                    itemsByDay.getOrDefault(i, List.of())));
        }

        List<AcademicItemDto> dueThisWeek = weekItems.stream()
                .sorted(Comparator.comparing(AcademicItem::getDueAt))
                .map(AcademicItemDto::from).toList();

        AcademicItemDto nextExam = (semesterId != null
                ? itemRepository.findFirstByCourseUserIdAndCourseSemesterIdAndTypeAndDueAtAfterOrderByDueAtAsc(
                        userId, semesterId, ItemType.EXAM, Instant.now())
                : itemRepository.findFirstByCourseUserIdAndTypeAndDueAtAfterOrderByDueAtAsc(
                        userId, ItemType.EXAM, Instant.now()))
                .map(AcademicItemDto::from).orElse(null);

        return new WeekView(weekStart, weekEnd, semester, days, dueThisWeek, nextExam);
    }

    private static int dayIndex(DayOfWeek d) {
        return d.ordinal();
    }

    private static DayOfWeek dayOfWeekForIndex(int i) {
        return DayOfWeek.values()[i];
    }
}
