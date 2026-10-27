package com.rnave.studily.canvas;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CourseCodes {

    private static final Pattern CODE = Pattern.compile("\\b([A-Za-z]{2,5})[ -]?(\\d{3,4}[A-Za-z]?)\\b");
    private static final Pattern NOT_A_SUBJECT = Pattern.compile(
            "(?i)fall|spring|summer|winter|term|year|jan|feb|mar|march|apr|april|may|june|jun|july|jul|aug|"
                    + "sept|sep|oct|nov|dec");

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
        while (m.find()) {
            if (NOT_A_SUBJECT.matcher(m.group(1)).matches()) {
                continue;
            }
            String normalized = (m.group(1) + " " + m.group(2)).toUpperCase(Locale.ROOT);
            return new Located(normalized, m.start(), m.end());
        }
        return null;
    }

    public static String baseKey(String text) {
        String code = find(text);
        return code == null ? null : code.replace(" ", "");
    }
}
