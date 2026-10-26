package com.rnave.studily.canvas;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.ics.IcsParser.ParsedEvent;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MoodleRefParser {

    private static final Pattern SUMMARY = Pattern.compile("(?i)^(.*?)\\s+(is due|opens|closes)\\s*$");

    private static final Pattern QUIZ_TITLE = Pattern.compile("(?i)\\bquiz\\b");

    private MoodleRefParser() {
    }

    public static LmsRef parse(ParsedEvent event) {
        String shortname = event.categories() == null ? null : event.categories().trim();
        if (shortname == null || shortname.isEmpty()) {
            return null;
        }
        if (shortname.length() > 100) {
            shortname = shortname.substring(0, 100);
        }
        Matcher m = SUMMARY.matcher(event.title());
        if (!m.matches() || m.group(1).isBlank()) {
            return null;
        }
        String word = m.group(2).toLowerCase(Locale.ROOT);
        if (word.equals("opens")) {
            return LmsRef.skip(shortname);
        }
        String title = m.group(1).trim();
        String uid = event.uid() == null || event.uid().isBlank()
                ? "moodle-" + shortname + "-" + title.toLowerCase(Locale.ROOT)
                : "moodle-" + event.uid().trim();
        String group = "moodle-" + shortname + "|" + title.toLowerCase(Locale.ROOT);
        return new LmsRef(LmsRef.Kind.ITEM, shortname, CourseCodes.find(shortname), shortname, uid, group,
                title, QUIZ_TITLE.matcher(title).find() ? ItemType.EXAM : null, word.equals("closes"));
    }
}
