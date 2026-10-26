package com.rnave.studily.canvas;

import com.rnave.studily.ics.IcsParser.ParsedEvent;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public enum LmsProvider {
    CANVAS, D2L, MOODLE;

    private static final Pattern MOODLE_UID = Pattern.compile("^\\d+@[^@\\s]+$");
    private static final Pattern MOODLE_SUMMARY = Pattern.compile("(?i)\\s(is due|opens|closes)\\s*$");

    public static LmsProvider fromSource(String source) {
        if (source == null) {
            return null;
        }
        String lower = source.trim().toLowerCase(Locale.ROOT);
        if (lower.contains("/feeds/calendars/") || lower.contains("instructure.com")) {
            return CANVAS;
        }
        if (lower.contains("/calendar/export_execute.php")) {
            return MOODLE;
        }
        if (lower.contains("/d2l/") || lower.contains("brightspace")) {
            return D2L;
        }
        return null;
    }

    public static LmsProvider fromEvents(List<ParsedEvent> events) {
        boolean d2l = false;
        boolean moodle = false;
        for (ParsedEvent event : events) {
            if (CanvasRef.parse(event.url()) != null || CanvasRef.parse(event.description()) != null) {
                return CANVAS;
            }
            if (event.url() != null && event.url().toLowerCase(Locale.ROOT).contains("/d2l/")) {
                d2l = true;
            }
            if (event.uid() != null && MOODLE_UID.matcher(event.uid()).matches()
                    && MOODLE_SUMMARY.matcher(event.title()).find()) {
                moodle = true;
            }
        }
        if (d2l) {
            return D2L;
        }
        return moodle ? MOODLE : null;
    }

    public static LmsProvider detect(String source, List<ParsedEvent> events) {
        LmsProvider fromSource = fromSource(source);
        return fromSource != null ? fromSource : fromEvents(events);
    }
}
