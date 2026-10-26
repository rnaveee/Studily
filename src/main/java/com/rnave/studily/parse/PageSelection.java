package com.rnave.studily.parse;

import com.rnave.studily.config.BadRequestException;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PageSelection {

    public static final PageSelection ALL = new PageSelection(List.of());

    static final int MAX_SPEC_CHARS = 100;
    static final int MAX_PARTS = 20;
    static final int MAX_PAGE = 10_000;

    private static final Pattern PART = Pattern.compile("(\\d{1,5})(?:\\s*[-–—]\\s*(\\d{1,5}|end|last)?)?");

    private record Part(int start, Integer end) {
    }

    private final List<Part> parts;

    private PageSelection(List<Part> parts) {
        this.parts = parts;
    }

    public static PageSelection parse(String spec) {
        if (spec == null || spec.isBlank()) {
            return ALL;
        }
        String value = spec.strip().toLowerCase(Locale.ROOT);
        if (value.equals("all")) {
            return ALL;
        }
        if (value.length() > MAX_SPEC_CHARS) {
            throw invalid(spec);
        }
        String[] pieces = value.split("[,;]");
        if (pieces.length > MAX_PARTS) {
            throw new BadRequestException("Pick at most " + MAX_PARTS + " page ranges per file.");
        }
        List<Part> parts = new ArrayList<>();
        for (String piece : pieces) {
            String trimmed = piece.strip();
            if (trimmed.isEmpty()) {
                continue;
            }
            Matcher m = PART.matcher(trimmed);
            if (!m.matches()) {
                throw invalid(spec);
            }
            int start = Integer.parseInt(m.group(1));
            boolean hasDash = trimmed.matches(".*[-–—].*");
            Integer end;
            if (!hasDash) {
                end = start;
            } else if (m.group(2) == null || m.group(2).equals("end") || m.group(2).equals("last")) {
                end = null;
            } else {
                end = Integer.parseInt(m.group(2));
            }
            if (start < 1 || start > MAX_PAGE || (end != null && (end < start || end > MAX_PAGE))) {
                throw invalid(spec);
            }
            parts.add(new Part(start, end));
        }
        return parts.isEmpty() ? ALL : new PageSelection(List.copyOf(parts));
    }

    public static List<PageSelection> forFiles(String[] specs, int fileCount) {
        List<PageSelection> out = new ArrayList<>();
        if (specs == null || specs.length == 0) {
            for (int i = 0; i < fileCount; i++) {
                out.add(ALL);
            }
            return out;
        }
        if (specs.length != fileCount) {
            throw new BadRequestException("Send one page range for each file.");
        }
        for (String spec : specs) {
            out.add(parse(spec));
        }
        return out;
    }

    public boolean all() {
        return parts.isEmpty();
    }

    public List<Integer> resolve(int count, String fileName, String unit) {
        List<Integer> pages = new ArrayList<>();
        if (all()) {
            for (int i = 1; i <= count; i++) {
                pages.add(i);
            }
            return pages;
        }
        TreeSet<Integer> picked = new TreeSet<>();
        for (Part part : parts) {
            if (part.start() > count || (part.end() != null && part.end() > count)) {
                throw new BadRequestException(fileName + " only has " + count + " "
                        + unit.toLowerCase(Locale.ROOT) + (count == 1 ? "" : "s")
                        + ". Pick " + unit.toLowerCase(Locale.ROOT) + "s between 1 and " + count + ".");
            }
            int end = part.end() == null ? count : part.end();
            for (int i = part.start(); i <= end; i++) {
                picked.add(i);
            }
        }
        pages.addAll(picked);
        return pages;
    }

    public String key() {
        if (all()) {
            return "all";
        }
        StringBuilder sb = new StringBuilder();
        for (Part part : parts) {
            if (!sb.isEmpty()) {
                sb.append(',');
            }
            sb.append(part.start()).append('-').append(part.end() == null ? "end" : part.end());
        }
        return sb.toString();
    }

    private static BadRequestException invalid(String spec) {
        String shown = spec.length() > 30 ? spec.substring(0, 30) + "…" : spec;
        return new BadRequestException("\"" + shown.strip() + "\" isn't a page range. Try something like 8-11, 9-end or 2, 5, 7-9.");
    }
}
