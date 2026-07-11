package com.rnave.studily.calendar;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public class CalendarEventDtos {

    public record CalendarEventDto(
            Long id,
            String title,
            String place,
            Instant startAt) {

        public static CalendarEventDto from(CalendarEvent e) {
            return new CalendarEventDto(e.getId(), e.getTitle(), e.getPlace(), e.getStartAt());
        }
    }

    public record CalendarEventRequest(
            @NotBlank @Size(max = 255) String title,
            @Size(max = 255) String place,
            @NotNull Instant startAt) {
    }
}
