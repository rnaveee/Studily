package com.rnave.studily.ics;

import com.rnave.studily.recurrence.Recurrence;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class IcsParser {

    private static final Duration PAST_WINDOW = Duration.ofDays(180);
    private static final Duration FUTURE_WINDOW = Duration.ofDays(400);
    private static final int MAX_OCCURRENCES_PER_EVENT = 400;

    private IcsParser() {
    }

    public record ParsedEvent(String uid, String title, String place, Instant startAt, boolean recurring) {
    }

    public record ParsedCalendar(String name, List<ParsedEvent> events, int skipped, boolean truncated) {
    }

    public static ParsedCalendar parse(String text, ZoneId fallbackZone, int maxEvents) {
        List<String> lines = unfold(text);
        List<ParsedEvent> events = new ArrayList<>();
        String calendarName = null;
        int skipped = 0;
        boolean truncated = false;

        Map<String, Prop> current = null;
        List<Prop> exdates = new ArrayList<>();

        for (String line : lines) {
            Prop prop = parseLine(line);
            if (prop == null) {
                continue;
            }
            String name = prop.name();

            if (name.equals("BEGIN") && prop.value().equalsIgnoreCase("VEVENT")) {
                current = new HashMap<>();
                exdates = new ArrayList<>();
                continue;
            }
            if (name.equals("END") && prop.value().equalsIgnoreCase("VEVENT")) {
                if (current == null) {
                    continue;
                }
                if (events.size() >= maxEvents) {
                    truncated = true;
                    current = null;
                    continue;
                }
                List<ParsedEvent> built = build(current, exdates, fallbackZone, maxEvents - events.size());
                if (built.isEmpty()) {
                    skipped++;
                } else {
                    events.addAll(built);
                }
                current = null;
                continue;
            }
            if (current == null) {
                if (name.equals("X-WR-CALNAME")) {
                    calendarName = unescape(prop.value());
                }
                continue;
            }
            if (name.equals("EXDATE")) {
                exdates.add(prop);
            } else {
                current.putIfAbsent(name, prop);
            }
        }

        return new ParsedCalendar(calendarName, events, skipped, truncated);
    }

    private static List<ParsedEvent> build(Map<String, Prop> props, List<Prop> exdateProps,
                                           ZoneId fallbackZone, int remaining) {
        Prop dtStart = props.get("DTSTART");
        Prop summary = props.get("SUMMARY");
        if (dtStart == null || summary == null || summary.value().isBlank()) {
            return List.of();
        }
        Prop status = props.get("STATUS");
        if (status != null && status.value().equalsIgnoreCase("CANCELLED")) {
            return List.of();
        }

        ZoneId zone = zoneOf(dtStart, fallbackZone);
        ZonedDateTime start = toZoned(dtStart.value(), zone);
        if (start == null) {
            return List.of();
        }

        String title = trimTo(unescape(summary.value()), 255);
        Prop location = props.get("LOCATION");
        String place = location == null || location.value().isBlank()
                ? null
                : trimTo(unescape(location.value()), 255);
        String uid = props.containsKey("UID") ? props.get("UID").value() : null;

        Set<Instant> exdates = new HashSet<>();
        for (Prop ex : exdateProps) {
            ZoneId exZone = zoneOf(ex, zone);
            for (String value : ex.value().split(",")) {
                ZonedDateTime excluded = toZoned(value.trim(), exZone);
                if (excluded != null) {
                    exdates.add(excluded.toInstant());
                }
            }
        }

        Prop rrule = props.get("RRULE");
        List<Instant> starts = rrule == null
                ? List.of(start.toInstant())
                : expand(start, rrule.value(), exdates, Math.min(remaining, MAX_OCCURRENCES_PER_EVENT));

        List<ParsedEvent> events = new ArrayList<>(starts.size());
        for (Instant at : starts) {
            events.add(new ParsedEvent(uid, title, place, at, rrule != null));
        }
        return events;
    }

    private static List<Instant> expand(ZonedDateTime start, String rule, Set<Instant> exdates, int cap) {
        Recurrence.Rule parsed = Recurrence.parse(rule, start.getZone());
        if (parsed == null) {
            return List.of(start.toInstant());
        }
        Instant now = Instant.now();
        return Recurrence.expand(start, parsed, exdates,
                now.minus(PAST_WINDOW), now.plus(FUTURE_WINDOW), cap);
    }

    private static ZoneId zoneOf(Prop prop, ZoneId fallback) {
        String tzid = prop.params().get("TZID");
        if (tzid == null || tzid.isBlank()) {
            return fallback;
        }
        try {
            return ZoneId.of(tzid.replace("\"", ""));
        } catch (RuntimeException e) {
            return fallback;
        }
    }

    private static ZonedDateTime toZoned(String value, ZoneId zone) {
        return Recurrence.parseIcsDateTime(value, zone);
    }

    private static List<String> unfold(String text) {
        List<String> out = new ArrayList<>();
        for (String raw : text.replace("\r\n", "\n").replace('\r', '\n').split("\n")) {
            if (!raw.isEmpty() && (raw.charAt(0) == ' ' || raw.charAt(0) == '\t') && !out.isEmpty()) {
                out.set(out.size() - 1, out.get(out.size() - 1) + raw.substring(1));
            } else {
                out.add(raw);
            }
        }
        return out;
    }

    private record Prop(String name, Map<String, String> params, String value) {
    }

    private static Prop parseLine(String line) {
        if (line.isBlank()) {
            return null;
        }
        boolean quoted = false;
        int colon = -1;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                quoted = !quoted;
            } else if (c == ':' && !quoted) {
                colon = i;
                break;
            }
        }
        if (colon < 0) {
            return null;
        }

        String head = line.substring(0, colon);
        String value = line.substring(colon + 1);
        Map<String, String> params = new HashMap<>();
        String name = head;

        int semi = head.indexOf(';');
        if (semi >= 0) {
            name = head.substring(0, semi);
            for (String param : head.substring(semi + 1).split(";")) {
                int eq = param.indexOf('=');
                if (eq > 0) {
                    params.put(param.substring(0, eq).trim().toUpperCase(Locale.ROOT), param.substring(eq + 1).trim());
                }
            }
        }
        return new Prop(name.trim().toUpperCase(Locale.ROOT), params, value);
    }

    private static String unescape(String value) {
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\\' && i + 1 < value.length()) {
                char next = value.charAt(++i);
                switch (next) {
                    case 'n', 'N' -> sb.append(' ');
                    case '\\', ',', ';' -> sb.append(next);
                    default -> sb.append(next);
                }
            } else {
                sb.append(c);
            }
        }
        return sb.toString().trim();
    }

    private static String trimTo(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
