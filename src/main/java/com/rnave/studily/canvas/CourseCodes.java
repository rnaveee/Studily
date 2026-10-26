package com.rnave.studily.canvas;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class CourseCodes {

    private static final Pattern CODE = Pattern.compile("\\b([A-Za-z]{2,5})[ -]?(\\d{3}[A-Za-z]?)\\b");

    private CourseCodes() {
    }

    static String find(String text) {
        if (text == null) {
            return null;
        }
        Matcher m = CODE.matcher(text);
        return m.find() ? (m.group(1) + " " + m.group(2)).toUpperCase(Locale.ROOT) : null;
    }
}
