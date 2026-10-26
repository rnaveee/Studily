package com.rnave.studily.calendar;

import com.rnave.studily.course.Course;
import com.rnave.studily.recurrence.RecurrenceDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class CalendarEventDtos {

    public record CalendarEventDto(
            Long id,
            String title,
            String place,
            Long categoryId,
            String categoryName,
            String categoryColor,
            Long courseId,
            String courseName,
            String courseCode,
            String courseColor,
            Instant startAt,
            UUID seriesId,
            String recurrenceRule) {

        public static CalendarEventDto from(CalendarEvent e) {
            EventCategory category = e.getCategory();
            Course course = e.getCourse();
            return new CalendarEventDto(
                    e.getId(),
                    e.getTitle(),
                    e.getPlace(),
                    category == null ? null : category.getId(),
                    category == null ? null : category.getName(),
                    category == null ? null : category.getColor(),
                    course == null ? null : course.getId(),
                    course == null ? null : course.getName(),
                    course == null ? null : course.getCode(),
                    course == null ? null : course.getColor(),
                    e.getStartAt(),
                    e.getSeriesId(),
                    e.getRecurrenceRule());
        }
    }

    public record CalendarEventRequest(
            @NotBlank @Size(max = 255) String title,
            @Size(max = 255) String place,
            Long categoryId,
            @NotNull Instant startAt,
            @Valid RecurrenceDto recurrence) {
    }
}
