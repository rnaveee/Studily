package com.rnave.studily.canvas;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public record CourseLabel(String name, String code) {

    private static final Pattern SECTIONS = Pattern.compile("^(?:[ \\t]+[A-Za-z]{1,3}\\d{1,3}[A-Za-z]?)+");
    private static final Pattern LEADING_SEPARATORS = Pattern.compile("^[\\s\\-\\u2013\\u2014:|,/]+");
    private static final Pattern TRAILING_SEPARATORS = Pattern.compile("[\\s\\-\\u2013\\u2014:|,/]+$");
    private static final Pattern SEPARATED = Pattern.compile("^\\s*[\\-\\u2013\\u2014:|]\\s*(.+)$");
    private static final int MAX = 255;

    public static CourseLabel parse(String text) {
        if (text == null || text.isBlank()) {
            return new CourseLabel(null, null);
        }
        String trimmed = text.trim();
        CourseCodes.Located located = CourseCodes.locate(trimmed);
        if (located == null) {
            return new CourseLabel(cap(trimmed), null);
        }
        String before = clean(trimmed.substring(0, located.start()));
        String rest = trimmed.substring(located.end());
        Matcher sections = SECTIONS.matcher(rest);
        int sectionEnd = sections.find() ? sections.end() : 0;
        String code = cap(trimmed.substring(located.start(), located.end() + sectionEnd).trim());
        if (!before.isEmpty()) {
            return new CourseLabel(cap(before), code);
        }
        Matcher trailing = SEPARATED.matcher(rest.substring(sectionEnd));
        if (trailing.matches()) {
            String named = clean(trailing.group(1));
            if (!named.isEmpty()) {
                return new CourseLabel(cap(named), code);
            }
        }
        return new CourseLabel(code, code);
    }

    public static boolean onlyCode(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String trimmed = text.trim();
        CourseCodes.Located located = CourseCodes.locate(trimmed);
        if (located == null || !clean(trimmed.substring(0, located.start())).isEmpty()) {
            return false;
        }
        String rest = trimmed.substring(located.end());
        Matcher sections = SECTIONS.matcher(rest);
        return clean(sections.find() ? rest.substring(sections.end()) : rest).isEmpty();
    }

    private static String clean(String value) {
        String out = LEADING_SEPARATORS.matcher(value).replaceFirst("");
        return TRAILING_SEPARATORS.matcher(out).replaceFirst("").trim();
    }

    private static String cap(String value) {
        return value.length() <= MAX ? value : value.substring(0, MAX);
    }
}
