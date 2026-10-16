package com.rnave.studily.linkpreview;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class LinkPreviewParser {

    private static final int TITLE_MAX = 200;
    private static final int DESCRIPTION_MAX = 300;
    private static final int SITE_MAX = 80;

    public record Meta(String title, String description, String siteName, String imageUrl, boolean social) {
    }

    private LinkPreviewParser() {
    }

    public static Meta parse(String html, URI base) {
        return parse(Jsoup.parse(html, base.toString()), base);
    }

    public static Meta parse(Document doc, URI base) {
        Map<String, String> meta = new HashMap<>();
        boolean social = false;
        for (Element el : doc.select("meta[content]")) {
            String key = el.hasAttr("property") ? el.attr("property") : el.attr("name");
            String content = el.attr("content");
            if (key.isBlank() || content.isBlank()) continue;
            String normalized = key.trim().toLowerCase(Locale.ROOT);
            social |= normalized.startsWith("og:") || normalized.startsWith("twitter:");
            meta.putIfAbsent(normalized, content);
        }

        String title = first(meta.get("og:title"), meta.get("twitter:title"), doc.title());
        String description = first(meta.get("og:description"), meta.get("twitter:description"), meta.get("description"));
        String site = first(meta.get("og:site_name"), host(base));
        String image = first(
                meta.get("og:image:secure_url"),
                meta.get("og:image"),
                meta.get("og:image:url"),
                meta.get("twitter:image"),
                meta.get("twitter:image:src"));

        return new Meta(clip(title, TITLE_MAX), clip(description, DESCRIPTION_MAX), clip(site, SITE_MAX),
                absolute(base, image), social);
    }

    public static Meta parseOembed(JsonNode json, URI base) {
        String title = text(json, "title");
        String description = first(text(json, "description"), text(json, "author_name"));
        String site = first(text(json, "provider_name"), host(base));
        return new Meta(clip(title, TITLE_MAX), clip(description, DESCRIPTION_MAX), clip(site, SITE_MAX),
                absolute(base, text(json, "thumbnail_url")), true);
    }

    private static String text(JsonNode json, String field) {
        JsonNode node = json.path(field);
        return node.isString() ? node.asString() : null;
    }

    static String host(URI uri) {
        String host = uri.getHost();
        if (host == null) return null;
        return host.startsWith("www.") ? host.substring(4) : host;
    }

    private static String first(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String clip(String value, int max) {
        if (value == null) return null;
        String clean = value.replaceAll("\\s+", " ").trim();
        if (clean.isEmpty()) return null;
        return clean.length() <= max ? clean : clean.substring(0, max - 1).trim() + "…";
    }

    private static String absolute(URI base, String raw) {
        if (raw == null) return null;
        try {
            URI resolved = base.resolve(raw.trim().replace(" ", "%20"));
            String scheme = resolved.getScheme() == null ? "" : resolved.getScheme().toLowerCase(Locale.ROOT);
            return scheme.equals("http") || scheme.equals("https") ? resolved.toString() : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
