package com.rnave.studily.recurrence;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class Recurrence {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
    private static final DateTimeFormatter DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter UNTIL_FMT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
    private static final int MAX_DAYS_SCANNED = 366 * 6;

    private Recurrence() {
    }

    public enum Freq {
        DAILY, WEEKLY, MONTHLY, YEARLY
    }

    public record Rule(Freq freq, int interval, Set<DayOfWeek> byDay, Instant until, Integer count) {

        public Rule {
            interval = Math.max(1, interval);
            byDay = byDay == null || byDay.isEmpty()
                    ? Set.of()
                    : Set.copyOf(EnumSet.copyOf(byDay));
        }
    }

    public static List<Instant> expand(ZonedDateTime start, Rule rule, Set<Instant> exclude,
                                       Instant windowStart, Instant windowEnd, int cap) {
        Set<DayOfWeek> byDay = rule.byDay().isEmpty()
                ? Set.of(start.getDayOfWeek())
                : rule.byDay();

        Instant end = windowEnd;
        if (rule.until() != null && rule.until().isBefore(end)) {
            end = rule.until();
        }

        List<Instant> out = new ArrayList<>();
        LocalDate startDate = start.toLocalDate();
        LocalDate cursor = startDate;
        int produced = 0;
        int scanned = 0;
        int count = rule.count() == null ? 0 : rule.count();

        while (out.size() < cap && scanned < MAX_DAYS_SCANNED) {
            scanned++;
            ZonedDateTime candidate = ZonedDateTime.of(cursor, start.toLocalTime(), start.getZone());
            Instant at = candidate.toInstant();
            if (at.isAfter(end)) {
                break;
            }
            if (matches(rule.freq(), rule.interval(), byDay, startDate, cursor)) {
                produced++;
                if (count > 0 && produced > count) {
                    break;
                }
                if (!exclude.contains(at) && !at.isBefore(windowStart)) {
                    out.add(at);
                }
            }
            cursor = cursor.plusDays(1);
        }
        return out;
    }

    public static Rule parse(String rrule, ZoneId zone) {
        Map<String, String> parts = new HashMap<>();
        for (String piece : rrule.split(";")) {
            int eq = piece.indexOf('=');
            if (eq > 0) {
                parts.put(piece.substring(0, eq).trim().toUpperCase(Locale.ROOT), piece.substring(eq + 1).trim());
            }
        }

        Freq freq;
        try {
            freq = Freq.valueOf(parts.getOrDefault("FREQ", "").toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }

        Instant until = null;
        if (parts.containsKey("UNTIL")) {
            ZonedDateTime parsed = parseIcsDateTime(parts.get("UNTIL"), zone);
            until = parsed == null ? null : parsed.toInstant();
        }

        Set<DayOfWeek> byDay = EnumSet.noneOf(DayOfWeek.class);
        if (parts.containsKey("BYDAY") && freq == Freq.WEEKLY) {
            for (String day : parts.get("BYDAY").split(",")) {
                DayOfWeek dow = dayOfWeek(day.trim());
                if (dow != null) {
                    byDay.add(dow);
                }
            }
        }

        int count = parseIntOr(parts.get("COUNT"), 0);
        return new Rule(freq, parseIntOr(parts.get("INTERVAL"), 1), byDay, until,
                count > 0 ? count : null);
    }

    public static String format(Rule rule) {
        StringBuilder sb = new StringBuilder("FREQ=").append(rule.freq().name());
        if (rule.interval() > 1) {
            sb.append(";INTERVAL=").append(rule.interval());
        }
        if (!rule.byDay().isEmpty()) {
            Set<String> codes = new LinkedHashSet<>();
            for (DayOfWeek day : orderedByDay(rule.byDay())) {
                codes.add(code(day));
            }
            sb.append(";BYDAY=").append(String.join(",", codes));
        }
        if (rule.count() != null) {
            sb.append(";COUNT=").append(rule.count());
        } else if (rule.until() != null) {
            sb.append(";UNTIL=").append(UNTIL_FMT.format(rule.until().atZone(ZoneId.of("UTC"))));
        }
        return sb.toString();
    }

    public static ZonedDateTime parseIcsDateTime(String value, ZoneId zone) {
        try {
            String raw = value.trim();
            if (raw.endsWith("Z")) {
                return LocalDateTime.parse(raw.substring(0, raw.length() - 1), DATE_TIME).atZone(ZoneId.of("UTC"));
            }
            if (raw.length() == 8) {
                return LocalDate.parse(raw, DATE).atStartOfDay(zone);
            }
            return LocalDateTime.parse(raw, DATE_TIME).atZone(zone);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static boolean matches(Freq freq, int interval, Set<DayOfWeek> byDay,
                                   LocalDate start, LocalDate date) {
        return switch (freq) {
            case DAILY -> daysBetween(start, date) % interval == 0;
            case WEEKLY -> byDay.contains(date.getDayOfWeek())
                    && (weeksBetween(start, date) % interval == 0);
            case MONTHLY -> date.getDayOfMonth() == start.getDayOfMonth()
                    && (monthsBetween(start, date) % interval == 0);
            case YEARLY -> date.getDayOfMonth() == start.getDayOfMonth()
                    && date.getMonth() == start.getMonth()
                    && ((date.getYear() - start.getYear()) % interval == 0);
        };
    }

    private static long daysBetween(LocalDate a, LocalDate b) {
        return b.toEpochDay() - a.toEpochDay();
    }

    private static long weeksBetween(LocalDate a, LocalDate b) {
        LocalDate weekA = a.minusDays(a.getDayOfWeek().getValue() % 7);
        LocalDate weekB = b.minusDays(b.getDayOfWeek().getValue() % 7);
        return daysBetween(weekA, weekB) / 7;
    }

    private static long monthsBetween(LocalDate a, LocalDate b) {
        return (b.getYear() - a.getYear()) * 12L + (b.getMonthValue() - a.getMonthValue());
    }

    private static List<DayOfWeek> orderedByDay(Set<DayOfWeek> days) {
        List<DayOfWeek> out = new ArrayList<>();
        for (DayOfWeek day : List.of(DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
                DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY)) {
            if (days.contains(day)) {
                out.add(day);
            }
        }
        return out;
    }

    private static String code(DayOfWeek day) {
        return switch (day) {
            case MONDAY -> "MO";
            case TUESDAY -> "TU";
            case WEDNESDAY -> "WE";
            case THURSDAY -> "TH";
            case FRIDAY -> "FR";
            case SATURDAY -> "SA";
            case SUNDAY -> "SU";
        };
    }

    public static DayOfWeek dayOfWeek(String token) {
        String value = token.length() > 2 ? token.substring(token.length() - 2) : token;
        return switch (value.toUpperCase(Locale.ROOT)) {
            case "MO" -> DayOfWeek.MONDAY;
            case "TU" -> DayOfWeek.TUESDAY;
            case "WE" -> DayOfWeek.WEDNESDAY;
            case "TH" -> DayOfWeek.THURSDAY;
            case "FR" -> DayOfWeek.FRIDAY;
            case "SA" -> DayOfWeek.SATURDAY;
            case "SU" -> DayOfWeek.SUNDAY;
            default -> null;
        };
    }

    private static int parseIntOr(String value, int fallback) {
        try {
            return value == null ? fallback : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
