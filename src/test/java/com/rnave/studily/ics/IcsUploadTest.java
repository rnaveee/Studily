package com.rnave.studily.ics;

import com.rnave.studily.config.BadRequestException;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IcsUploadTest {

    private static final String CALENDAR = """
            BEGIN:VCALENDAR
            VERSION:2.0
            BEGIN:VEVENT
            UID:one@example.com
            SUMMARY:Lecture
            DTSTART:20260901T173000Z
            END:VEVENT
            END:VCALENDAR
            """;

    @Test
    void readsAPlainIcsFile() {
        String text = IcsUpload.textFrom(CALENDAR.getBytes(StandardCharsets.UTF_8), "basic.ics");

        assertThat(text).contains("BEGIN:VCALENDAR").contains("one@example.com");
    }

    @Test
    void readsEveryCalendarInsideAGoogleExportZip() throws IOException {
        byte[] zip = zip(Map.of(
                "personal@gmail.com.ics", CALENDAR,
                "school@gmail.com.ics", CALENDAR.replace("one@example.com", "two@example.com")));

        String text = IcsUpload.textFrom(zip, "calendars.zip");

        assertThat(text).contains("one@example.com").contains("two@example.com");
    }

    @Test
    void ignoresNonCalendarEntriesInAZip() throws IOException {
        byte[] zip = zip(Map.of(
                "notes.txt", "not a calendar",
                "__MACOSX/._personal.ics", "resource fork junk",
                "personal.ics", CALENDAR));

        String text = IcsUpload.textFrom(zip, "calendars.zip");

        assertThat(text).contains("one@example.com").doesNotContain("resource fork junk");
    }

    @Test
    void rejectsAZipWithNoCalendarsInIt() throws IOException {
        byte[] zip = zip(Map.of("readme.txt", "nothing here"));

        assertThatThrownBy(() -> IcsUpload.textFrom(zip, "calendars.zip"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("no calendar");
    }

    @Test
    void rejectsAFileThatIsNotACalendar() {
        byte[] bytes = "just some text".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> IcsUpload.textFrom(bytes, "notes.ics"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("iCalendar");
    }

    @Test
    void rejectsAnEmptyFile() {
        assertThatThrownBy(() -> IcsUpload.textFrom(new byte[0], "empty.ics"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("empty");
    }

    private byte[] zip(Map<String, String> entries) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            for (Map.Entry<String, String> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }
}
