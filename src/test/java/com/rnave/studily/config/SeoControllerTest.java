package com.rnave.studily.config;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

class SeoControllerTest {

    private static final String BASE = "https://studily.example";

    private static JsonNode routes;
    private static SeoController controller;

    @BeforeAll
    static void setUp(@TempDir Path dir) throws IOException {
        routes = JsonMapper.builder().build().readTree(Files.readString(Path.of("frontend/src/routes.json")));
        Files.writeString(dir.resolve("routes.json"), routes.toString());
        SpaPages pages = new SpaPages(new DefaultResourceLoader(), "file:" + dir + "/", BASE + "/");
        controller = new SeoController(pages);
    }

    private static List<String> publicPaths() {
        List<String> out = new ArrayList<>();
        routes.get("public").forEach(n -> out.add(n.get("path").asString()));
        return out;
    }

    private static List<String> disallows(String robots) {
        return robots.lines().filter(l -> l.startsWith("Disallow: ")).map(l -> l.substring(10)).toList();
    }

    @Test
    void robotsListsFirstSegmentsOfAppRoutesExceptSets() {
        String robots = controller.robotsTxt();
        TreeSet<String> expected = new TreeSet<>();
        for (JsonNode pattern : routes.get("app")) {
            String first = pattern.asString().substring(1).split("/")[0];
            if (!first.equals("sets")) {
                expected.add("/" + first);
            }
        }
        expected.add("/api/");

        assertThat(robots).startsWith("User-agent: *\nAllow: /\nAllow: /api/public/\nDisallow: /api/\n");
        assertThat(disallows(robots)).containsExactlyInAnyOrderElementsOf(expected);
        assertThat(robots).contains("Disallow: /dashboard").doesNotContain("/sets");
        assertThat(robots).endsWith("\nSitemap: " + BASE + "/sitemap.xml\n");
    }

    @Test
    void noDisallowIsAPrefixOfAPublicPath() {
        for (String line : disallows(controller.robotsTxt())) {
            for (String path : publicPaths()) {
                assertThat(path.startsWith(line)).as(line + " vs " + path).isFalse();
            }
        }
    }

    @Test
    void sitemapListsExactlyThePublicPaths() {
        String xml = controller.sitemapXml();
        List<String> locs = new ArrayList<>();
        xml.lines().map(String::trim).filter(l -> l.startsWith("<url>")).forEach(l ->
                locs.add(l.replace("<url><loc>", "").replace("</loc></url>", "")));
        List<String> expected = publicPaths().stream().map(p -> BASE + p).toList();

        assertThat(xml).contains("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
        assertThat(xml).doesNotContain("lastmod");
        assertThat(locs).containsExactlyElementsOf(expected);
        assertThat(locs).contains(BASE + "/", BASE + "/about");
    }

    @Test
    void endpointsUseTheRightContentTypes() {
        assertThat(controller.robots().getHeaders().getContentType().toString()).isEqualTo("text/plain;charset=UTF-8");
        assertThat(controller.sitemap().getHeaders().getContentType().isCompatibleWith(MediaType.APPLICATION_XML)).isTrue();
        assertThat(controller.sitemap().getHeaders().getContentType().getCharset()).isNotNull();
    }
}
