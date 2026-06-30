package com.rnave.studily.dashboard;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.semester.SemesterDtos.SemesterDto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class DashboardDtos {

    public record ScheduledMeeting(
            Long courseId,
            String courseName,
            String code,
            String professor,
            String color,
            DayOfWeek dayOfWeek,
            LocalTime startTime,
            LocalTime endTime) {
    }

    public record DayColumn(
            LocalDate date,
            DayOfWeek dayOfWeek,
            List<ScheduledMeeting> meetings,
            List<AcademicItemDto> items) {
    }

    public record WeekView(
            LocalDate weekStart,
            LocalDate weekEnd,
            SemesterDto semester,
            List<DayColumn> days,
            List<AcademicItemDto> dueThisWeek,
            AcademicItemDto nextExam) {
    }
}
