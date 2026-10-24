package com.rnave.studily.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SpaRoutingIntegrationTest {

    private static final String BASE = "https://studily.example";
    private static final Path PAGES = createPages();

    @LocalServerPort
    private int port;

    private final HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();

    private static Path createPages() {
        try {
            Path dir = Files.createTempDirectory("studily-spa-pages");
            dir.toFile().deleteOnExit();
            Files.writeString(dir.resolve("routes.json"), Files.readString(Path.of("frontend/src/routes.json")));
            Files.writeString(dir.resolve("index.html"), "<html>HOME __STUDILY_BASE_URL__/</html>");
            Files.createDirectories(dir.resolve("about"));
            Files.writeString(dir.resolve("about/index.html"), "<html>ABOUT __STUDILY_BASE_URL__/about</html>");
            Files.writeString(dir.resolve("404.html"), "<html>NOTFOUND</html>");
            Files.writeString(dir.resolve("app.html"),
                    "<html><head><meta name=\"robots\" content=\"noindex\" />"
                            + "<meta name=\"description\" content=\"Generic\" /></head><body>SHELL</body></html>");
            return dir;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.spa.pages", () -> "file:" + PAGES + "/");
        registry.add("app.base-url", () -> BASE);
    }

    private HttpResponse<String> get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void homeIsPrerenderedWithBaseUrlAndCsp() throws Exception {
        HttpResponse<String> response = get("/");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("HOME " + BASE + "/");
        assertThat(response.headers().firstValue("Content-Type").orElse("")).startsWith("text/html");
        assertThat(response.headers().firstValue("Content-Security-Policy")).isPresent();
    }

    @Test
    void publicPageIsPrerendered() throws Exception {
        HttpResponse<String> response = get("/about");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("ABOUT " + BASE + "/about");
        assertThat(response.headers().firstValue("Content-Security-Policy")).isPresent();
    }

    @Test
    void appRouteGetsTheNoindexShell() throws Exception {
        HttpResponse<String> response = get("/courses/42");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("SHELL").contains("name=\"robots\" content=\"noindex\"");
    }

    @Test
    void sharedSetPageGoesThroughItsControllerWithNoindex() throws Exception {
        HttpResponse<String> response = get("/sets/999999999");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("SHELL").contains("name=\"robots\" content=\"noindex\"");
    }

    @Test
    void unknownPathsAre404Html() throws Exception {
        for (String path : new String[]{"/made-up", "/courses/42/extra", "/prerender/app.html", "/prerender/"}) {
            HttpResponse<String> response = get(path);
            assertThat(response.statusCode()).as(path).isEqualTo(404);
            assertThat(response.body()).as(path).contains("NOTFOUND");
            assertThat(response.headers().firstValue("Content-Type").orElse("")).startsWith("text/html");
        }
    }

    @Test
    void unknownPublicApiPathIsJson404() throws Exception {
        HttpResponse<String> response = get("/api/public/does-not-exist");
        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.headers().firstValue("Content-Type").orElse("")).startsWith("application/json");
        assertThat(response.body()).contains("\"status\":404").contains("\"timestamp\"");
        assertThat(response.headers().firstValue("X-Robots-Tag")).hasValue("noindex");
    }

    @Test
    void robotsAndSitemapAreServed() throws Exception {
        HttpResponse<String> robots = get("/robots.txt");
        assertThat(robots.statusCode()).isEqualTo(200);
        assertThat(robots.headers().firstValue("Content-Type").orElse("")).startsWith("text/plain");
        assertThat(robots.body()).contains("Disallow: /dashboard").contains("Sitemap: " + BASE + "/sitemap.xml");

        HttpResponse<String> sitemap = get("/sitemap.xml");
        assertThat(sitemap.statusCode()).isEqualTo(200);
        assertThat(sitemap.headers().firstValue("Content-Type").orElse("")).contains("xml");
        assertThat(sitemap.body()).contains("<loc>" + BASE + "/about</loc>");
    }

    @Test
    void nonPublicApiResponsesDoNotCarryRobotsHeader() throws Exception {
        HttpResponse<String> response = get("/about");
        assertThat(response.headers().firstValue("X-Robots-Tag")).isEmpty();
    }
}
