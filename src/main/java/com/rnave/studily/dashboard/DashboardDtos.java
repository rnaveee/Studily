package com.rnave.studily.dashboard;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.course.MeetingKind;
import com.rnave.studily.semester.SemesterDtos.SemesterDto;
import com.rnave.studily.todo.TodoDtos.TodoDto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class DashboardDtos {

    public record ScheduledMeeting(
            Long courseId,
            String courseName,
            String code,
            String professor,
            String location,
            String color,
            MeetingKind kind,
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
            List<TodoDto> todosDueThisWeek,
            AcademicItemDto nextExam) {
    }
}
