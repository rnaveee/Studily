package com.rnave.studily.ics;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public final class IcsWriter {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
    private static final String DOMAIN = "studily.ca";

    private IcsWriter() {
    }

    public static String write(List<AcademicItem> items, List<CalendarEvent> events) {
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\n");
        line(sb, "VERSION", "2.0");
        line(sb, "PRODID", "-//Studily//Studily Planner//EN");
        line(sb, "CALSCALE", "GREGORIAN");
        line(sb, "METHOD", "PUBLISH");
        line(sb, "X-WR-CALNAME", "Studily");

        String stamp = stamp(Instant.now());

        for (AcademicItem item : items) {
            String courseName = item.getCourse().getName();
            String code = item.getCourse().getCode();
            String label = item.getType() == ItemType.EXAM ? "Exam" : "Assignment";
            StringBuilder description = new StringBuilder(label + " for " + courseName);
            if (item.getWeight() != null) {
                description.append(" - worth ").append(trimNumber(item.getWeight())).append("% of the grade");
            }

            sb.append("BEGIN:VEVENT\r\n");
            line(sb, "UID", "item-" + item.getId() + "@" + DOMAIN);
            line(sb, "DTSTAMP", stamp);
            line(sb, "DTSTART", stamp(item.getDueAt()));
            line(sb, "DTEND", stamp(item.getDueAt().plus(Duration.ofMinutes(30))));
            line(sb, "SUMMARY", (code == null ? "" : code + " - ") + item.getTitle());
            line(sb, "DESCRIPTION", description.toString());
            if (item.getLocation() != null) {
                line(sb, "LOCATION", item.getLocation());
            }
            line(sb, "CATEGORIES", label.toUpperCase());
            sb.append("END:VEVENT\r\n");
        }

        for (CalendarEvent event : events) {
            sb.append("BEGIN:VEVENT\r\n");
            line(sb, "UID", "event-" + event.getId() + "@" + DOMAIN);
            line(sb, "DTSTAMP", stamp);
            line(sb, "DTSTART", stamp(event.getStartAt()));
            line(sb, "DTEND", stamp(event.getStartAt().plus(Duration.ofHours(1))));
            line(sb, "SUMMARY", event.getTitle());
            if (event.getPlace() != null) {
                line(sb, "LOCATION", event.getPlace());
            }
            if (event.getCategory() != null) {
                line(sb, "CATEGORIES", event.getCategory().getName());
            }
            sb.append("END:VEVENT\r\n");
        }

        sb.append("END:VCALENDAR\r\n");
        return sb.toString();
    }

    private static String stamp(Instant at) {
        return ZonedDateTime.ofInstant(at, ZoneId.of("UTC")).format(STAMP);
    }

    private static String trimNumber(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    private static void line(StringBuilder sb, String name, String value) {
        sb.append(fold(name + ":" + escape(value))).append("\r\n");
    }

    private static String escape(String value) {
        return value
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r\n", "\\n")
                .replace("\n", "\\n");
    }

    private static String fold(String line) {
        if (line.length() <= 75) {
            return line;
        }
        StringBuilder sb = new StringBuilder(line.length() + 8);
        int index = 0;
        while (index < line.length()) {
            int take = Math.min(index == 0 ? 75 : 74, line.length() - index);
            if (index > 0) {
                sb.append("\r\n ");
            }
            sb.append(line, index, index + take);
            index += take;
        }
        return sb.toString();
    }
}
