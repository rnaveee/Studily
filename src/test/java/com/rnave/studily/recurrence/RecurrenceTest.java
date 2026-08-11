package com.rnave.studily.recurrence;

import com.rnave.studily.recurrence.Recurrence.Freq;
import com.rnave.studily.recurrence.Recurrence.Rule;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class RecurrenceTest {

    private static final ZoneId VANCOUVER = ZoneId.of("America/Vancouver");

    private static ZonedDateTime at(String isoLocal) {
        return LocalDateTime.parse(isoLocal).atZone(VANCOUVER);
    }

    private static List<LocalDate> datesOf(List<Instant> occurrences) {
        return occurrences.stream().map(i -> i.atZone(VANCOUVER).toLocalDate()).toList();
    }

    private static List<Instant> expand(ZonedDateTime start, Rule rule, int cap) {
        return Recurrence.expand(start, rule, Set.of(), Instant.MIN,
                start.toInstant().plusSeconds(365L * 24 * 3600), cap);
    }

    @Test
    void expand_weeklyOnMultipleWeekdays() {
        Rule rule = new Rule(Freq.WEEKLY, 1,
                Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY), null, 6);

        List<Instant> out = expand(at("2026-09-07T09:30"), rule, 100);

        assertThat(datesOf(out)).containsExactly(
                LocalDate.parse("2026-09-07"), LocalDate.parse("2026-09-09"),
                LocalDate.parse("2026-09-14"), LocalDate.parse("2026-09-16"),
                LocalDate.parse("2026-09-21"), LocalDate.parse("2026-09-23"));
    }

    @Test
    void expand_everyOtherWeekKeepsFourteenDayGaps() {
        Rule rule = new Rule(Freq.WEEKLY, 2, Set.of(DayOfWeek.FRIDAY), null, 4);

        List<Instant> out = expand(at("2026-09-11T23:59"), rule, 100);

        assertThat(datesOf(out)).containsExactly(
                LocalDate.parse("2026-09-11"), LocalDate.parse("2026-09-25"),
                LocalDate.parse("2026-10-09"), LocalDate.parse("2026-10-23"));
    }

    @Test
    void expand_dailyHonoursInterval() {
        Rule rule = new Rule(Freq.DAILY, 3, Set.of(), null, 4);

        List<Instant> out = expand(at("2026-09-07T08:00"), rule, 100);

        assertThat(datesOf(out)).containsExactly(
                LocalDate.parse("2026-09-07"), LocalDate.parse("2026-09-10"),
                LocalDate.parse("2026-09-13"), LocalDate.parse("2026-09-16"));
    }

    @Test
    void expand_monthlyKeepsDayOfMonth() {
        Rule rule = new Rule(Freq.MONTHLY, 1, Set.of(), null, 3);

        List<Instant> out = expand(at("2026-09-15T12:00"), rule, 100);

        assertThat(datesOf(out)).containsExactly(
                LocalDate.parse("2026-09-15"), LocalDate.parse("2026-10-15"),
                LocalDate.parse("2026-11-15"));
    }

    @Test
    void expand_untilStopsTheSeriesInclusiveOfTheBoundary() {
        Instant until = at("2026-09-21T09:30").toInstant();
        Rule rule = new Rule(Freq.WEEKLY, 1, Set.of(DayOfWeek.MONDAY), until, null);

        List<Instant> out = expand(at("2026-09-07T09:30"), rule, 100);

        assertThat(datesOf(out)).containsExactly(
                LocalDate.parse("2026-09-07"), LocalDate.parse("2026-09-14"),
                LocalDate.parse("2026-09-21"));
    }

    @Test
    void expand_countWinsOverALongWindow() {
        Rule rule = new Rule(Freq.WEEKLY, 1, Set.of(DayOfWeek.MONDAY), null, 2);

        assertThat(expand(at("2026-09-07T09:30"), rule, 100)).hasSize(2);
    }

    @Test
    void expand_stopsAtTheCap() {
        Rule rule = new Rule(Freq.DAILY, 1, Set.of(), null, null);

        assertThat(expand(at("2026-09-07T09:30"), rule, 10)).hasSize(10);
    }

    @Test
    void expand_defaultsWeeklyByDayToTheStartWeekday() {
        Rule rule = new Rule(Freq.WEEKLY, 1, Set.of(), null, 3);

        assertThat(datesOf(expand(at("2026-09-10T09:30"), rule, 100))).containsExactly(
                LocalDate.parse("2026-09-10"), LocalDate.parse("2026-09-17"),
                LocalDate.parse("2026-09-24"));
    }

    @Test
    void expand_skipsExcludedOccurrencesWithoutShiftingTheRest() {
        ZonedDateTime start = at("2026-09-07T09:30");
        Rule rule = new Rule(Freq.WEEKLY, 1, Set.of(DayOfWeek.MONDAY), null, 3);
        Set<Instant> exclude = Set.of(at("2026-09-14T09:30").toInstant());

        List<Instant> out = Recurrence.expand(start, rule, exclude, Instant.MIN,
                start.toInstant().plusSeconds(365L * 24 * 3600), 100);

        assertThat(datesOf(out)).containsExactly(
                LocalDate.parse("2026-09-07"), LocalDate.parse("2026-09-21"));
    }

    @Test
    void expand_windowStartDropsEarlierOccurrences() {
        ZonedDateTime start = at("2026-09-07T09:30");
        Rule rule = new Rule(Freq.WEEKLY, 1, Set.of(DayOfWeek.MONDAY), null, 3);

        List<Instant> out = Recurrence.expand(start, rule, Set.of(),
                at("2026-09-10T00:00").toInstant(),
                start.toInstant().plusSeconds(365L * 24 * 3600), 100);

        assertThat(datesOf(out)).containsExactly(
                LocalDate.parse("2026-09-14"), LocalDate.parse("2026-09-21"));
    }

    @Test
    void parse_readsFrequencyIntervalByDayAndCount() {
        Rule rule = Recurrence.parse("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=8", VANCOUVER);

        assertThat(rule.freq()).isEqualTo(Freq.WEEKLY);
        assertThat(rule.interval()).isEqualTo(2);
        assertThat(rule.byDay()).containsExactlyInAnyOrder(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY);
        assertThat(rule.count()).isEqualTo(8);
        assertThat(rule.until()).isNull();
    }

    @Test
    void parse_returnsNullForAnUnsupportedFrequency() {
        assertThat(Recurrence.parse("FREQ=HOURLY;COUNT=3", VANCOUVER)).isNull();
        assertThat(Recurrence.parse("COUNT=3", VANCOUVER)).isNull();
    }

    @Test
    void parse_ignoresByDayWhenTheFrequencyIsNotWeekly() {
        Rule rule = Recurrence.parse("FREQ=MONTHLY;BYDAY=MO", VANCOUVER);

        assertThat(rule.byDay()).isEmpty();
    }

    @Test
    void format_roundTripsThroughParse() {
        Rule rule = new Rule(Freq.WEEKLY, 2,
                Set.of(DayOfWeek.MONDAY, DayOfWeek.FRIDAY), null, 12);

        String formatted = Recurrence.format(rule);
        assertThat(formatted).isEqualTo("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;COUNT=12");

        Rule reparsed = Recurrence.parse(formatted, VANCOUVER);
        assertThat(reparsed).isEqualTo(rule);
    }

    @Test
    void format_emitsUntilInUtcWhenThereIsNoCount() {
        Instant until = LocalDateTime.parse("2026-12-06T23:59").atZone(ZoneId.of("UTC")).toInstant();
        Rule rule = new Rule(Freq.WEEKLY, 1, Set.of(), until, null);

        assertThat(Recurrence.format(rule)).isEqualTo("FREQ=WEEKLY;UNTIL=20261206T235900Z");
    }

    @Test
    void rule_normalisesANonPositiveInterval() {
        assertThat(new Rule(Freq.WEEKLY, 0, Set.of(), null, null).interval()).isEqualTo(1);
    }
}
