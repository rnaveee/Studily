package com.rnave.studily.config;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.TreeSet;

@Controller
public class SeoController {

    private static final String OPEN_SEGMENT = "sets";

    private final SpaPages pages;

    public SeoController(SpaPages pages) {
        this.pages = pages;
    }

    @GetMapping("/robots.txt")
    public ResponseEntity<String> robots() {
        return respond(new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8), robotsTxt());
    }

    @GetMapping("/sitemap.xml")
    public ResponseEntity<String> sitemap() {
        return respond(new MediaType(MediaType.APPLICATION_XML, StandardCharsets.UTF_8), sitemapXml());
    }

    private static ResponseEntity<String> respond(MediaType type, String body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .contentType(type)
                .body(body);
    }

    String robotsTxt() {
        List<String> publicPaths = pages.publicPaths();
        TreeSet<String> blocked = new TreeSet<>();
        for (String pattern : pages.appPatterns()) {
            String first = firstSegment(pattern);
            if (first.isEmpty() || first.equals(OPEN_SEGMENT)) {
                continue;
            }
            String line = "/" + first;
            boolean hidesPublicPage = publicPaths.stream().anyMatch(p -> p.startsWith(line));
            if (!hidesPublicPage) {
                blocked.add(line);
            }
        }
        StringBuilder sb = new StringBuilder();
        sb.append("User-agent: *\n");
        sb.append("Allow: /\n");
        sb.append("Allow: /api/public/\n");
        sb.append("Disallow: /api/\n");
        for (String line : blocked) {
            sb.append("Disallow: ").append(line).append('\n');
        }
        sb.append('\n');
        sb.append("Sitemap: ").append(pages.baseUrl()).append("/sitemap.xml\n");
        return sb.toString();
    }

    String sitemapXml() {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (String path : pages.publicPaths()) {
            sb.append("  <url><loc>").append(escape(pages.baseUrl() + path)).append("</loc></url>\n");
        }
        sb.append("</urlset>\n");
        return sb.toString();
    }

    private static String firstSegment(String pattern) {
        String p = pattern.startsWith("/") ? pattern.substring(1) : pattern;
        int slash = p.indexOf('/');
        return slash < 0 ? p : p.substring(0, slash);
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
