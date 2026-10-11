package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.SetPagePreview;
import org.springframework.web.util.HtmlUtils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SetPageMeta {

    private static final int MAX_DESCRIPTION = 300;
    private static final Pattern TITLE = Pattern.compile("<title>[^<]*</title>");

    private SetPageMeta() {}

    public static String render(String html, SetPagePreview preview, String url, String imageUrl) {
        String title = "Studily - " + preview.title() + " by " + preview.ownerLabel();
        String description = describe(preview);
        String out = TITLE.matcher(html)
                .replaceFirst(Matcher.quoteReplacement("<title>" + HtmlUtils.htmlEscape(title, "UTF-8") + "</title>"));
        out = meta(out, "name", "description", description);
        out = meta(out, "property", "og:title", title);
        out = meta(out, "property", "og:description", description);
        out = meta(out, "property", "og:url", url);
        out = meta(out, "property", "og:image", imageUrl);
        out = meta(out, "property", "og:image:alt", preview.title() + " flashcard set on Studily");
        out = meta(out, "name", "twitter:title", title);
        out = meta(out, "name", "twitter:description", description);
        out = meta(out, "name", "twitter:image", imageUrl);
        return out;
    }

    static String describe(SetPagePreview preview) {
        String owner = preview.ownerName() != null && !preview.ownerName().isBlank()
                ? preview.ownerName() + " (@" + preview.ownerUsername() + ")"
                : "@" + preview.ownerUsername();
        String cards = preview.cardCount() == 1 ? "1 card" : preview.cardCount() + " cards";
        String text = "Flashcard set by " + owner + " · " + cards + ". Study it free on Studily.";
        if (preview.description() != null && !preview.description().isBlank()) {
            text = preview.description().trim() + " · " + text;
        }
        return text.length() > MAX_DESCRIPTION ? text.substring(0, MAX_DESCRIPTION - 1).trim() + "…" : text;
    }

    private static String meta(String html, String attr, String key, String value) {
        Pattern pattern = Pattern.compile("(<meta\\s+" + attr + "=\"" + Pattern.quote(key) + "\"\\s+content=\")[^\"]*(\")");
        return pattern.matcher(html).replaceFirst("$1" + Matcher.quoteReplacement(HtmlUtils.htmlEscape(value, "UTF-8")) + "$2");
    }
}
