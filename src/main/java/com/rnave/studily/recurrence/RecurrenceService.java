package com.rnave.studily.recurrence;

import com.rnave.studily.config.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class RecurrenceService {

    public static final int MAX_OCCURRENCES = 200;
    private static final Duration COUNT_HORIZON = Duration.ofDays(366L * 5);

    private final ZoneId zone;

    public RecurrenceService(@Value("${app.timezone}") String timezone) {
        this.zone = ZoneId.of(timezone);
    }

    public record Expansion(UUID seriesId, String rule, List<Instant> starts) {
    }

    public ZoneId zone() {
        return zone;
    }

    public Expansion expand(Instant start, RecurrenceDto dto) {
        if (dto.until() == null && dto.count() == null) {
            throw new BadRequestException("Choose when the repeat ends");
        }
        if (dto.until() != null && dto.count() != null) {
            throw new BadRequestException("Set an end date or a number of times, not both");
        }
        if (dto.until() != null && !dto.until().isAfter(start)) {
            throw new BadRequestException("The repeat must end after it starts");
        }

        Recurrence.Rule rule = new Recurrence.Rule(
                dto.freq(), dto.interval(), toJavaDays(dto.byDay()), dto.until(), dto.count());

        ZonedDateTime zoned = start.atZone(zone);
        Instant windowEnd = dto.until() != null ? dto.until() : start.plus(COUNT_HORIZON);

        List<Instant> starts = Recurrence.expand(
                zoned, rule, Set.of(), start, windowEnd, MAX_OCCURRENCES + 1);

        if (starts.size() > MAX_OCCURRENCES) {
            throw new BadRequestException(
                    "That repeats more than " + MAX_OCCURRENCES + " times. Shorten it or end it sooner.");
        }
        if (starts.isEmpty()) {
            throw new BadRequestException("That repeat produces no dates");
        }

        return new Expansion(UUID.randomUUID(), Recurrence.format(rule), starts);
    }

    public Instant withTimeOfDay(Instant original, Instant source) {
        LocalTime time = source.atZone(zone).toLocalTime();
        return original.atZone(zone).toLocalDate().atTime(time).atZone(zone).toInstant();
    }

    private static Set<java.time.DayOfWeek> toJavaDays(Set<com.rnave.studily.course.DayOfWeek> days) {
        if (days == null || days.isEmpty()) {
            return Set.of();
        }
        List<java.time.DayOfWeek> out = new ArrayList<>();
        for (com.rnave.studily.course.DayOfWeek day : EnumSet.copyOf(days)) {
            out.add(switch (day) {
                case SUN -> java.time.DayOfWeek.SUNDAY;
                case MON -> java.time.DayOfWeek.MONDAY;
                case TUE -> java.time.DayOfWeek.TUESDAY;
                case WED -> java.time.DayOfWeek.WEDNESDAY;
                case THU -> java.time.DayOfWeek.THURSDAY;
                case FRI -> java.time.DayOfWeek.FRIDAY;
                case SAT -> java.time.DayOfWeek.SATURDAY;
            });
        }
        return Set.copyOf(out);
    }
}
