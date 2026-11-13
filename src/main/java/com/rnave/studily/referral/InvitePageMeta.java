package com.rnave.studily.referral;

import org.springframework.web.util.HtmlUtils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class InvitePageMeta {

    private static final Pattern TITLE = Pattern.compile("<title>[^<]*</title>");

    private InvitePageMeta() {}

    public static String render(String html, String inviterName, String url, String imageUrl) {
        String title = InvitePreviewImage.headline(inviterName);
        String description = "Join " + inviterName + " on Studily: your whole semester on one screen. Free for students.";
        String out = TITLE.matcher(html)
                .replaceFirst(Matcher.quoteReplacement("<title>" + HtmlUtils.htmlEscape(title, "UTF-8") + "</title>"));
        out = meta(out, "name", "description", description);
        out = meta(out, "property", "og:title", title);
        out = meta(out, "property", "og:description", description);
        out = meta(out, "property", "og:url", url);
        out = meta(out, "property", "og:image", imageUrl);
        out = meta(out, "property", "og:image:alt", title);
        out = meta(out, "name", "twitter:title", title);
        out = meta(out, "name", "twitter:description", description);
        out = meta(out, "name", "twitter:image", imageUrl);
        return out;
    }

    private static String meta(String html, String attr, String key, String value) {
        Pattern pattern = Pattern.compile("(<meta\\s+" + attr + "=\"" + Pattern.quote(key) + "\"\\s+content=\")[^\"]*(\")");
        return pattern.matcher(html).replaceFirst("$1" + Matcher.quoteReplacement(HtmlUtils.htmlEscape(value, "UTF-8")) + "$2");
    }
}
