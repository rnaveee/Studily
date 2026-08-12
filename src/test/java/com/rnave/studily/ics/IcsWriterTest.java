package com.rnave.studily.ics;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.course.Course;
import com.rnave.studily.ics.IcsParser.ParsedCalendar;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IcsWriterTest {

    private static AcademicItem item() {
        Course course = new Course();
        course.setName("Fundamentals of Digital Logic & Design");
        course.setCode("ENSC252");

        AcademicItem item = new AcademicItem();
        item.setId(7L);
        item.setCourse(course);
        item.setType(ItemType.EXAM);
        item.setTitle("Midterm; chapters 1,2");
        item.setDueAt(Instant.parse("2026-10-15T18:00:00Z"));
        item.setWeight(25.0);
        return item;
    }

    private static CalendarEvent event() {
        CalendarEvent event = new CalendarEvent();
        event.setId(3L);
        event.setTitle("Advising appointment");
        event.setPlace("AQ 3005");
        event.setStartAt(Instant.parse("2026-09-20T17:00:00Z"));
        return event;
    }

    @Test
    void write_producesCrlfLinesAndStableUids() {
        String ics = IcsWriter.write(List.of(item()), List.of(event()));

        assertThat(ics).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n");
        assertThat(ics).contains("UID:item-7@studily.ca");
        assertThat(ics).contains("UID:event-3@studily.ca");
        assertThat(ics).contains("DTSTART:20261015T180000Z");
    }

    @Test
    void write_escapesBareCarriageReturnsSoTitlesCannotInjectProperties() {
        CalendarEvent event = event();
        event.setTitle("Study\rATTENDEE:mailto:someone@example.com\rX-INJECTED:1");

        String ics = IcsWriter.write(List.of(), List.of(event));

        assertThat(ics).doesNotContain("\rATTENDEE:").doesNotContain("\rX-INJECTED:");
        assertThat(ics).contains("SUMMARY:Study\\nATTENDEE:mailto:someone@example.com\\nX-INJEC");
    }

    @Test
    void write_escapesReservedCharactersAndFoldsLongLines() {
        String ics = IcsWriter.write(List.of(item()), List.of());

        assertThat(ics).contains("SUMMARY:ENSC252 - Midterm\\; chapters 1\\,2");
        for (String line : ics.split("\r\n")) {
            assertThat(line.length()).isLessThanOrEqualTo(75);
        }
    }

    @Test
    void write_roundTripsThroughTheParser() {
        String ics = IcsWriter.write(List.of(item()), List.of(event()));

        ParsedCalendar parsed = IcsParser.parse(ics, ZoneId.of("UTC"), 100);

        assertThat(parsed.name()).isEqualTo("Studily");
        assertThat(parsed.events()).hasSize(2);
        assertThat(parsed.events().getFirst().title()).isEqualTo("ENSC252 - Midterm; chapters 1,2");
        assertThat(parsed.events().getFirst().startAt()).isEqualTo(Instant.parse("2026-10-15T18:00:00Z"));
        assertThat(parsed.events().getLast().title()).isEqualTo("Advising appointment");
        assertThat(parsed.events().getLast().place()).isEqualTo("AQ 3005");
    }
}
