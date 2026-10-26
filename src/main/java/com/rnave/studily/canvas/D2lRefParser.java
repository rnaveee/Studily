package com.rnave.studily.canvas;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.ics.IcsParser.ParsedEvent;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class D2lRefParser {

    private static final Pattern ORG_UNIT = Pattern.compile("(?i)[?&]ou=(\\d+)");
    private static final Pattern ORG_UNIT_PATH = Pattern.compile("(?i)/d2l/(?:le/calendar|home)/(\\d+)");
    private static final Pattern DROPBOX = Pattern.compile("(?i)[?&]db=(\\d+)");
    private static final Pattern QUIZ = Pattern.compile("(?i)[?&]qi=(\\d+)");
    private static final Pattern SUFFIX = Pattern.compile(
            "(?i)^(.*?)\\s*[-\\u2013\\u2014:]\\s*(due(?: date)?|availability ends|availability starts|"
                    + "ends?|starts?|opens?|closes?|available(?: from)?)\\s*$");

    private D2lRefParser() {
    }

    public static LmsRef parse(ParsedEvent event) {
        String url = event.url();
        String courseKey = courseKey(url);
        if (courseKey == null) {
            return null;
        }
        Matcher dropbox = DROPBOX.matcher(url);
        Matcher quiz = QUIZ.matcher(url);
        boolean isDropbox = dropbox.find();
        boolean isQuizId = quiz.find();
        boolean isQuiz = isQuizId || url.toLowerCase(Locale.ROOT).contains("/quizzing/");

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
        } else if (!isDropbox && !isQuiz) {
            return null;
        }

        String itemKey;
        if (isDropbox) {
            itemKey = "db" + dropbox.group(1);
        } else if (isQuizId) {
            itemKey = "qi" + quiz.group(1);
        } else {
            itemKey = "t" + title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        }

        String uid = "d2l-" + courseKey + "-" + itemKey;
        String place = event.place();
        String code = CourseCodes.find(place);
        if (code == null) {
            code = CourseCodes.find(event.title());
        }
        return new LmsRef(LmsRef.Kind.ITEM, courseKey, code, place, uid, uid, title,
                isQuiz ? ItemType.EXAM : null, closing);
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
}
