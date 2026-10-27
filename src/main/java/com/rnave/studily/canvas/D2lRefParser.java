package com.rnave.studily.canvas;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.ics.IcsParser.ParsedEvent;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class D2lRefParser {

    private static final Pattern ORG_UNIT = Pattern.compile("(?i)[?&]ou=(\\d+)");
    private static final Pattern ORG_UNIT_PATH = Pattern.compile("(?i)/d2l/(?:le/calendar|home)/(\\d+)");
    private static final Pattern DROPBOX = Pattern.compile("(?i)[?&]db=(\\d+)");
    private static final Pattern QUIZ = Pattern.compile("(?i)[?&]qi=(\\d+)");
    private static final Pattern LINK = Pattern.compile("(?i)https?://\\S+");
    private static final Pattern EVENT_UID = Pattern.compile("^\\d+-(\\d+)@");
    private static final Pattern EXAM_WORDS = Pattern.compile(
            "(?i)\\b(quiz(?:zes)?|exams?|midterms?|finals?|tests?)\\b");
    private static final Pattern TOOL_PREFIX = Pattern.compile("(?i)^(?:assignment|discussion|survey)\\s*:\\s*(.+)$");
    private static final Pattern SUFFIX = Pattern.compile(
            "(?i)^(.*?)\\s*[-\\u2013\\u2014:]\\s*(due(?: date)?|availability ends|availability starts|"
                    + "ends?|starts?|opens?|closes?|available(?: from)?)\\s*$");

    private D2lRefParser() {
    }

    public static LmsRef parse(ParsedEvent event) {
        return parse(event, null);
    }

    public static LmsRef parse(ParsedEvent event, String knownCourseKey) {
        List<String> links = links(event);
        String courseKey = null;
        String dropboxId = null;
        String quizId = null;
        boolean quizTool = false;
        for (String link : links) {
            if (courseKey == null) {
                courseKey = courseKey(link);
            }
            if (dropboxId == null) {
                dropboxId = first(DROPBOX, link);
            }
            if (quizId == null) {
                quizId = first(QUIZ, link);
            }
            quizTool |= link.toLowerCase(Locale.ROOT).contains("/quizzing/");
        }
        if (courseKey == null) {
            return knownCourseKey == null ? null : examEvent(event, knownCourseKey);
        }
        boolean isQuiz = quizId != null || quizTool;

        String title = event.title();
        boolean closing = false;
        Matcher suffix = SUFFIX.matcher(title);
        if (suffix.matches()) {
            String word = suffix.group(2).toLowerCase(Locale.ROOT);
            if (word.startsWith("start") || word.startsWith("open") || word.startsWith("available")
                    || word.equals("availability starts")) {
                return LmsRef.skip(courseKey);
            }
            closing = !word.startsWith("due");
            if (!suffix.group(1).isBlank()) {
                title = suffix.group(1).trim();
            }
        } else if (dropboxId == null && !isQuiz) {
            return examEvent(event, courseKey);
        }
        Matcher prefix = TOOL_PREFIX.matcher(title);
        if (prefix.matches()) {
            title = prefix.group(1).trim();
        }

        String itemKey;
        if (dropboxId != null) {
            itemKey = "db" + dropboxId;
        } else if (quizId != null) {
            itemKey = "qi" + quizId;
        } else {
            itemKey = slug(title);
        }

        String uid = "d2l-" + courseKey + "-" + itemKey;
        ItemType type = isQuiz && EXAM_WORDS.matcher(title).find() ? ItemType.EXAM : null;
        return new LmsRef(LmsRef.Kind.ITEM, courseKey, code(event), event.place(), uid, uid, title, type, closing);
    }

    private static LmsRef examEvent(ParsedEvent event, String courseKey) {
        if (!EXAM_WORDS.matcher(event.title()).find()) {
            return null;
        }
        Matcher id = EVENT_UID.matcher(event.uid() == null ? "" : event.uid().trim());
        String uid = "d2l-" + courseKey + "-" + (id.find() ? "ev" + id.group(1) : slug(event.title()));
        return new LmsRef(LmsRef.Kind.ITEM, courseKey, code(event), event.place(), uid, uid, event.title(),
                ItemType.EXAM, false);
    }

    static String courseKey(String url) {
        if (url == null) {
            return null;
        }
        Matcher m = ORG_UNIT.matcher(url);
        if (m.find()) {
            return m.group(1);
        }
        m = ORG_UNIT_PATH.matcher(url);
        return m.find() ? m.group(1) : null;
    }

    static String linkedCourseKey(ParsedEvent event) {
        for (String link : links(event)) {
            String key = courseKey(link);
            if (key != null) {
                return key;
            }
        }
        return null;
    }

    private static List<String> links(ParsedEvent event) {
        List<String> links = new ArrayList<>();
        if (event.url() != null) {
            links.add(event.url());
        }
        if (event.description() != null) {
            Matcher m = LINK.matcher(event.description());
            while (m.find()) {
                if (m.group().toLowerCase(Locale.ROOT).contains("/d2l/")) {
                    links.add(m.group());
                }
            }
        }
        return links;
    }

    private static String first(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        return m.find() ? m.group(1) : null;
    }

    private static String code(ParsedEvent event) {
        String code = CourseCodes.find(event.place());
        return code != null ? code : CourseCodes.find(event.title());
    }

    private static String slug(String title) {
        return "t" + title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
    }
}
