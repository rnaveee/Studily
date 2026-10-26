package com.rnave.studily.canvas;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CourseCodes {

    private static final Pattern CODE = Pattern.compile("\\b([A-Za-z]{2,5})[ -]?(\\d{3}[A-Za-z]?)\\b");

    private CourseCodes() {
    }

    public record Located(String normalized, int start, int end) {
    }

    public static String find(String text) {
        Located located = locate(text);
        return located == null ? null : located.normalized();
    }

    public static Located locate(String text) {
        if (text == null) {
            return null;
        }
        Matcher m = CODE.matcher(text);
        if (!m.find()) {
            return null;
        }
        String normalized = (m.group(1) + " " + m.group(2)).toUpperCase(Locale.ROOT);
        return new Located(normalized, m.start(), m.end());
    }

    public static String baseKey(String text) {
        String code = find(text);
        return code == null ? null : code.replace(" ", "");
    }
}
