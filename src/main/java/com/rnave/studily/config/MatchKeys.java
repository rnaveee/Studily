package com.rnave.studily.config;

import java.util.Locale;
import java.util.Set;

public final class MatchKeys {

    private static final Set<String> SCHOOL_STOPWORDS =
            Set.of("university", "college", "institute", "school", "the", "of");

    private MatchKeys() {
    }

    public static String schoolKey(String school) {
        if (school == null) {
            return null;
        }
        String[] tokens = school.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim()
                .split("\\s+");
        StringBuilder key = new StringBuilder();
        for (String token : tokens) {
            if (!token.isEmpty() && !SCHOOL_STOPWORDS.contains(token)) {
                key.append(token);
            }
        }
        return key.isEmpty() ? null : key.toString();
    }

    public static String codeKey(String code) {
        if (code == null) {
            return null;
        }
        String key = code.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        return key.isEmpty() ? null : key;
    }
}
