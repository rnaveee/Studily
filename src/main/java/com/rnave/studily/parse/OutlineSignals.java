package com.rnave.studily.parse;

import java.util.List;
import java.util.regex.Pattern;

final class OutlineSignals {

    static final int REQUIRED = 2;

    private static final List<Pattern> SIGNALS = List.of(
            Pattern.compile("\\b[A-Z]{2,5}\\s?-?\\d{3}[A-Z]?\\b"),
            Pattern.compile("\\d{1,3}(?:\\.\\d+)?\\s?%"),
            Pattern.compile("(?i)\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\b"
                    + "|\\b\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b"
                    + "|(?i)\\b(?:mon|tue|wed|thu|fri)[a-z]*day\\b"),
            Pattern.compile("(?i)\\b(?:syllabus|outline|grading|grade|midterm|final exam|exam|lecture|"
                    + "assignment|quiz|tutorial|instructor|professor|office hours|course|semester|term|"
                    + "credit|prerequisite)s?\\b"));

    private OutlineSignals() {
    }

    static boolean looksLikeOutline(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        int found = 0;
        for (Pattern signal : SIGNALS) {
            if (signal.matcher(text).find() && ++found >= REQUIRED) {
                return true;
            }
        }
        return false;
    }
}
