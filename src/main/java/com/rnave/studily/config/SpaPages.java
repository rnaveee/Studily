package com.rnave.studily.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Component
public class SpaPages {

    public record Page(int status, String html) {
    }

    private static final Logger log = LoggerFactory.getLogger(SpaPages.class);
    private static final String PLACEHOLDER = "__STUDILY_BASE_URL__";
    private static final String FALLBACK_404 =
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\" />"
                    + "<meta name=\"robots\" content=\"noindex\" /><title>Page not found</title></head>"
                    + "<body><h1>Page not found</h1><p><a href=\"/\">Go home</a></p></body></html>";

    private final String baseUrl;
    private final List<String> publicPaths = new ArrayList<>();
    private final List<String> appPatterns = new ArrayList<>();
    private final Map<String, String> publicPages = new HashMap<>();
    private String shell;
    private String notFound = FALLBACK_404;

    public SpaPages(ResourceLoader loader,
                    @Value("${app.spa.pages:classpath:/static/prerender/}") String location,
                    @Value("${app.base-url}") String baseUrl) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        String root = location.endsWith("/") ? location : location + "/";
        try {
            load(loader, root);
        } catch (Exception e) {
            publicPaths.clear();
            appPatterns.clear();
            publicPages.clear();
            shell = null;
            notFound = FALLBACK_404;
            log.warn("Prerendered pages are unavailable at {} ({}); public pages and the app shell will 404 until the frontend is built",
                    root, e.toString());
        }
    }

    private void load(ResourceLoader loader, String root) throws IOException {
        Resource routesResource = loader.getResource(root + "routes.json");
        if (!routesResource.exists()) {
            throw new IOException("routes.json not found");
        }
        JsonNode routes;
        try (InputStream in = routesResource.getInputStream()) {
            routes = JsonMapper.builder().build().readTree(in);
        }
        for (JsonNode entry : routes.path("public")) {
            publicPaths.add(entry.path("path").asString());
        }
        for (JsonNode pattern : routes.path("app")) {
            appPatterns.add(pattern.asString());
        }
        for (String path : publicPaths) {
            String page = read(loader, root + fileFor(path));
            if (page != null) {
                publicPages.put(path, page);
            }
        }
        shell = read(loader, root + "app.html");
        String missing = read(loader, root + "404.html");
        if (missing != null) {
            notFound = missing;
        }
        if (shell == null || publicPages.size() < publicPaths.size()) {
            log.warn("Some prerendered pages are missing at {}", root);
        }
    }

    private String read(ResourceLoader loader, String location) throws IOException {
        Resource resource = loader.getResource(location);
        if (!resource.exists()) {
            return null;
        }
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).replace(PLACEHOLDER, baseUrl);
        }
    }

    private static String fileFor(String path) {
        return path.equals("/") ? "index.html" : path.substring(1) + "/index.html";
    }

    public Page resolve(String path) {
        String[] segments = segments(path);
        for (String publicPath : publicPaths) {
            if (matches(segments(publicPath), segments)) {
                String html = publicPages.get(publicPath);
                if (html != null) {
                    return new Page(200, html);
                }
            }
        }
        if (shell != null) {
            for (String pattern : appPatterns) {
                if (matches(segments(pattern), segments)) {
                    return new Page(200, shell);
                }
            }
        }
        return new Page(404, notFound);
    }

    private static String[] segments(String path) {
        String p = path == null ? "" : path;
        int cut = p.indexOf('?');
        if (cut >= 0) {
            p = p.substring(0, cut);
        }
        if (p.startsWith("/")) {
            p = p.substring(1);
        }
        if (p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p.isEmpty() ? new String[0] : p.split("/", -1);
    }

    private static boolean matches(String[] pattern, String[] actual) {
        if (pattern.length != actual.length) {
            return false;
        }
        for (int i = 0; i < pattern.length; i++) {
            if (pattern[i].startsWith(":")) {
                if (actual[i].isEmpty()) {
                    return false;
                }
            } else if (!pattern[i].toLowerCase(Locale.ROOT).equals(actual[i].toLowerCase(Locale.ROOT))) {
                return false;
            }
        }
        return true;
    }

    public Optional<String> shell() {
        return Optional.ofNullable(shell);
    }

    public List<String> publicPaths() {
        return List.copyOf(publicPaths);
    }

    public List<String> appPatterns() {
        return List.copyOf(appPatterns);
    }

    public String baseUrl() {
        return baseUrl;
    }
}
