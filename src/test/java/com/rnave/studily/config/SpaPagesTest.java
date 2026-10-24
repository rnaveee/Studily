package com.rnave.studily.config;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.DefaultResourceLoader;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SpaPagesTest {

    private static final String BASE = "https://studily.example";
    private static final String SHELL_HTML =
            "<html><head><meta name=\"robots\" content=\"noindex\" /></head><body>SHELL __STUDILY_BASE_URL__</body></html>";

    private static JsonNode routes;
    private static Path pagesDir;
    private static SpaPages pages;

    @BeforeAll
    static void setUp(@TempDir Path dir) throws IOException {
        pagesDir = dir;
        routes = JsonMapper.builder().build().readTree(Files.readString(Path.of("frontend/src/routes.json")));
        writePages(dir, routes);
        pages = new SpaPages(new DefaultResourceLoader(), "file:" + dir + "/", BASE);
    }

    static void writePages(Path dir, JsonNode routes) throws IOException {
        Files.writeString(dir.resolve("routes.json"), routes.toString());
        for (JsonNode entry : routes.get("public")) {
            String path = entry.get("path").asString();
            Path file = path.equals("/") ? dir.resolve("index.html") : dir.resolve(path.substring(1)).resolve("index.html");
            Files.createDirectories(file.getParent());
            Files.writeString(file, "<html>PAGE[" + path + "] __STUDILY_BASE_URL__/x __STUDILY_BASE_URL__</html>");
        }
        Files.writeString(dir.resolve("app.html"), SHELL_HTML);
        Files.writeString(dir.resolve("404.html"), "<html>NOTFOUND __STUDILY_BASE_URL__</html>");
    }

    private static List<String> publicPaths() {
        List<String> out = new ArrayList<>();
        routes.get("public").forEach(n -> out.add(n.get("path").asString()));
        return out;
    }

    private static String fill(String pattern) {
        return pattern.replaceAll(":[A-Za-z]+", "42");
    }

    @Test
    void everyPublicPathServesItsOwnPageWithBaseUrl() {
        for (String path : publicPaths()) {
            SpaPages.Page page = pages.resolve(path);
            assertThat(page.status()).as(path).isEqualTo(200);
            assertThat(page.html()).as(path).contains("PAGE[" + path + "]");
            assertThat(page.html()).as(path).contains(BASE + "/x").doesNotContain("__STUDILY_BASE_URL__");
        }
    }

    @Test
    void everyAppPatternServesTheNoindexShell() {
        for (JsonNode pattern : routes.get("app")) {
            SpaPages.Page page = pages.resolve(fill(pattern.asString()));
            assertThat(page.status()).as(pattern.asString()).isEqualTo(200);
            assertThat(page.html()).as(pattern.asString()).contains("name=\"robots\" content=\"noindex\"");
            assertThat(page.html()).contains("SHELL " + BASE);
        }
    }

    @Test
    void toleratesTrailingSlashCaseAndQueryStrings() {
        assertThat(pages.resolve("/about/").html()).contains("PAGE[/about]");
        assertThat(pages.resolve("/About").html()).contains("PAGE[/about]");
        assertThat(pages.resolve("/ABOUT/?ref=x").html()).contains("PAGE[/about]");
        assertThat(pages.resolve("/").html()).contains("PAGE[/]");
        assertThat(pages.resolve("/Courses/42/").html()).contains("SHELL");
        assertThat(pages.resolve("/dashboard?x=1").status()).isEqualTo(200);
    }

    @Test
    void unknownExtraSegmentAndEmptyParamPathsAre404() {
        for (String path : List.of("/made-up", "/courses/1/extra", "/courses//", "/about/more", "/dashboard/x", "/prerender/app.html", "/index.html")) {
            SpaPages.Page page = pages.resolve(path);
            assertThat(page.status()).as(path).isEqualTo(404);
            assertThat(page.html()).as(path).contains("NOTFOUND " + BASE);
        }
    }

    @Test
    void exposesRoutesAndShell() {
        assertThat(pages.publicPaths()).containsExactlyElementsOf(publicPaths());
        assertThat(pages.appPatterns()).contains("/courses/:id");
        assertThat(pages.shell()).isPresent();
        assertThat(pages.baseUrl()).isEqualTo(BASE);
    }

    @Test
    void trimsTrailingSlashesFromBaseUrl() {
        SpaPages trimmed = new SpaPages(new DefaultResourceLoader(), "file:" + pagesDir, BASE + "//");
        assertThat(trimmed.baseUrl()).isEqualTo(BASE);
        assertThat(trimmed.resolve("/about").html()).contains(BASE + "/x");
    }

    @Test
    void missingDirectoryDegradesToMinimal404(@TempDir Path other) {
        SpaPages missing = new SpaPages(new DefaultResourceLoader(), "file:" + other.resolve("nope") + "/", BASE);
        assertThat(missing.shell()).isEmpty();
        assertThat(missing.publicPaths()).isEmpty();
        assertThat(missing.appPatterns()).isEmpty();
        SpaPages.Page page = missing.resolve("/about");
        assertThat(page.status()).isEqualTo(404);
        assertThat(page.html()).contains("Page not found");
        assertThat(missing.resolve("/dashboard").status()).isEqualTo(404);
    }
}
