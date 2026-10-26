package com.rnave.studily.ics;

import com.rnave.studily.ics.IcsParser.ParsedCalendar;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class IcsParserCategoriesTest {

    @Test
    void parse_readsCategoriesWhenPresentAndNullWhenAbsent() {
        ParsedCalendar parsed = IcsParser.parse("""
                BEGIN:VCALENDAR\r
                BEGIN:VEVENT\r
                UID:1@moodle.example.edu\r
                SUMMARY:Essay is due\r
                DTSTART:20261001T000000Z\r
                CATEGORIES:HIST\\, 210\r
                END:VEVENT\r
                BEGIN:VEVENT\r
                UID:2@moodle.example.edu\r
                SUMMARY:Office hours\r
                DTSTART:20261002T000000Z\r
                END:VEVENT\r
                END:VCALENDAR\r
                """, ZoneId.of("UTC"), 10);

        assertThat(parsed.events()).hasSize(2);
        assertThat(parsed.events().get(0).categories()).isEqualTo("HIST, 210");
        assertThat(parsed.events().get(1).categories()).isNull();
    }
}
