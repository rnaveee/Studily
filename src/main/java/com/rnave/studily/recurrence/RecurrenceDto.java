package com.rnave.studily.recurrence;

import com.rnave.studily.course.DayOfWeek;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.Set;

public record RecurrenceDto(
        @NotNull Recurrence.Freq freq,
        @Min(1) @Max(52) int interval,
        Set<DayOfWeek> byDay,
        Instant until,
        @Min(1) @Max(RecurrenceService.MAX_OCCURRENCES) Integer count) {
}
