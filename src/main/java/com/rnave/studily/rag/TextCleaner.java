package com.rnave.studily.rag;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

final class TextCleaner {

    static final int EDGE_LINES = 3;
    static final double REPEAT_SHARE = 0.6;
    static final int MIN_PAGES_FOR_REPEATS = 4;

    private static final Pattern HYPHEN_BREAK = Pattern.compile("(\\p{Ll})-\\n(\\p{Ll})");
    private static final Pattern SPACES = Pattern.compile("[ \\t\\x0B\\f\\u00A0]+");
    private static final Pattern TRAILING_SPACE = Pattern.compile(" +\\n");
    private static final Pattern MANY_NEWLINES = Pattern.compile("\\n{3,}");
    private static final Pattern DIGITS = Pattern.compile("\\d+");

    private TextCleaner() {
    }

    static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String text = raw.replace("\r\n", "\n")
                .replace('\r', '\n')
                .replace("­", "")
                .replace("﻿", "");
        text = HYPHEN_BREAK.matcher(text).replaceAll("$1$2");
        text = SPACES.matcher(text).replaceAll(" ");
        text = TRAILING_SPACE.matcher(text).replaceAll("\n");
        text = MANY_NEWLINES.matcher(text).replaceAll("\n\n");
        return text.strip();
    }

    static List<String> removeRepeatedEdges(List<String> pages) {
        if (pages.size() < MIN_PAGES_FOR_REPEATS) {
            return pages;
        }
        Map<String, Integer> counts = new HashMap<>();
        for (String page : pages) {
            Set<String> seenOnThisPage = new HashSet<>();
            String[] lines = page.split("\n", -1);
            for (int index : edgeIndexes(lines)) {
                String key = fingerprint(lines[index]);
                if (!key.isEmpty() && seenOnThisPage.add(key)) {
                    counts.merge(key, 1, Integer::sum);
                }
            }
        }
        int threshold = (int) Math.ceil(pages.size() * REPEAT_SHARE);
        Set<String> repeated = counts.entrySet().stream()
                .filter(entry -> entry.getValue() >= threshold)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
        if (repeated.isEmpty()) {
            return pages;
        }
        return pages.stream().map(page -> stripEdges(page, repeated)).toList();
    }

    static String fingerprint(String line) {
        return DIGITS.matcher(line.strip().toLowerCase(Locale.ROOT)).replaceAll("#");
    }

    private static String stripEdges(String page, Set<String> repeated) {
        String[] lines = page.split("\n", -1);
        for (int index : edgeIndexes(lines)) {
            if (repeated.contains(fingerprint(lines[index]))) {
                lines[index] = "";
            }
        }
        return String.join("\n", lines);
    }

    private static List<Integer> edgeIndexes(String[] lines) {
        List<Integer> nonBlank = new ArrayList<>();
        for (int i = 0; i < lines.length; i++) {
            if (!lines[i].isBlank()) {
                nonBlank.add(i);
            }
        }
        Set<Integer> edges = new HashSet<>();
        for (int i = 0; i < Math.min(EDGE_LINES, nonBlank.size()); i++) {
            edges.add(nonBlank.get(i));
            edges.add(nonBlank.get(nonBlank.size() - 1 - i));
        }
        return List.copyOf(edges);
    }
}
