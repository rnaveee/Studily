package com.rnave.studily.ics;

import com.rnave.studily.ics.IcsParser.ParsedCalendar;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.assertThat;

class IcsParserTest {

    private static final ZoneId VANCOUVER = ZoneId.of("America/Vancouver");
    private static final DateTimeFormatter BASIC = DateTimeFormatter.ofPattern("yyyyMMdd");

    private static String wrap(String body) {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:My classes\r\n" + body + "END:VCALENDAR\r\n";
    }

    private static String soon(int daysFromNow) {
        return LocalDate.now(VANCOUVER).plusDays(daysFromNow).format(BASIC);
    }

    @Test
    void parse_readsSummaryLocationAndUtcStart() {
        ParsedCalendar parsed = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                UID:abc-123\r
                SUMMARY:CMPT 225 Lecture\r
                LOCATION:AQ 3005\r
                DTSTART:20260910T173000Z\r
                END:VEVENT\r
                """), VANCOUVER, 100);

        assertThat(parsed.name()).isEqualTo("My classes");
        assertThat(parsed.events()).hasSize(1);
        assertThat(parsed.events().getFirst().title()).isEqualTo("CMPT 225 Lecture");
        assertThat(parsed.events().getFirst().place()).isEqualTo("AQ 3005");
        assertThat(parsed.events().getFirst().uid()).isEqualTo("abc-123");
        assertThat(parsed.events().getFirst().startAt())
                .isEqualTo(ZonedDateTime.of(2026, 9, 10, 17, 30, 0, 0, ZoneId.of("UTC")).toInstant());
    }

    @Test
    void parse_appliesTzidToFloatingTimes() {
        ParsedCalendar parsed = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                SUMMARY:Lab\r
                DTSTART;TZID=America/Vancouver:20260910T093000\r
                END:VEVENT\r
                """), ZoneId.of("UTC"), 100);

        assertThat(parsed.events().getFirst().startAt())
                .isEqualTo(ZonedDateTime.of(2026, 9, 10, 9, 30, 0, 0, VANCOUVER).toInstant());
    }

    @Test
    void parse_treatsAllDayDatesAsMidnightInTheUsersZone() {
        ParsedCalendar parsed = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                SUMMARY:Reading break\r
                DTSTART;VALUE=DATE:20261012\r
                END:VEVENT\r
                """), VANCOUVER, 100);

        assertThat(parsed.events().getFirst().startAt())
                .isEqualTo(LocalDate.of(2026, 10, 12).atStartOfDay(VANCOUVER).toInstant());
    }

    @Test
    void parse_unfoldsWrappedLinesAndUnescapesText() {
        ParsedCalendar parsed = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                SUMMARY:Midterm\\, chapters 1-4\r
                 and 7\r
                DTSTART:20261012T190000Z\r
                END:VEVENT\r
                """), VANCOUVER, 100);

        assertThat(parsed.events().getFirst().title()).isEqualTo("Midterm, chapters 1-4and 7");
    }

    @Test
    void parse_expandsWeeklyRecurrenceWithByDayAndCount() {
        ParsedCalendar parsed = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                UID:weekly-1\r
                SUMMARY:Tutorial\r
                DTSTART;TZID=America/Vancouver:%sT143000\r
                RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4\r
                END:VEVENT\r
                """.formatted(soon(1))), VANCOUVER, 100);

        assertThat(parsed.events()).hasSizeLessThanOrEqualTo(4);
        assertThat(parsed.events()).isNotEmpty();
        assertThat(parsed.events()).allSatisfy(e -> assertThat(e.recurring()).isTrue());
        assertThat(parsed.events().stream().map(e -> e.startAt()).distinct().count())
                .isEqualTo(parsed.events().size());
    }

    @Test
    void parse_skipsExcludedOccurrences() {
        String start = soon(2);
        ParsedCalendar withoutExclusion = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                SUMMARY:Standup\r
                DTSTART;TZID=America/Vancouver:%sT090000\r
                RRULE:FREQ=DAILY;COUNT=3\r
                END:VEVENT\r
                """.formatted(start)), VANCOUVER, 100);

        ParsedCalendar withExclusion = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                SUMMARY:Standup\r
                DTSTART;TZID=America/Vancouver:%sT090000\r
                RRULE:FREQ=DAILY;COUNT=3\r
                EXDATE;TZID=America/Vancouver:%sT090000\r
                END:VEVENT\r
                """.formatted(start, start)), VANCOUVER, 100);

        assertThat(withExclusion.events()).hasSize(withoutExclusion.events().size() - 1);
    }

    @Test
    void parse_ignoresCancelledAndUntitledEvents() {
        ParsedCalendar parsed = IcsParser.parse(wrap("""
                BEGIN:VEVENT\r
                SUMMARY:Cancelled class\r
                STATUS:CANCELLED\r
                DTSTART:20261012T190000Z\r
                END:VEVENT\r
                BEGIN:VEVENT\r
                DTSTART:20261013T190000Z\r
                END:VEVENT\r
                """), VANCOUVER, 100);

        assertThat(parsed.events()).isEmpty();
        assertThat(parsed.skipped()).isEqualTo(2);
    }

    @Test
    void parse_stopsAtTheEventCapAndReportsTruncation() {
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < 5; i++) {
            body.append("BEGIN:VEVENT\r\nSUMMARY:Event ").append(i)
                    .append("\r\nDTSTART:2026101%dT190000Z\r\nEND:VEVENT\r\n".formatted(i));
        }

        ParsedCalendar parsed = IcsParser.parse(wrap(body.toString()), VANCOUVER, 2);

        assertThat(parsed.events()).hasSize(2);
        assertThat(parsed.truncated()).isTrue();
    }
}
