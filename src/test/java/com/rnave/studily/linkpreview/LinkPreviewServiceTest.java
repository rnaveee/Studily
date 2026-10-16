package com.rnave.studily.linkpreview;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.PublicUrlFetcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LinkPreviewServiceTest {

    private PublicUrlFetcher fetcher;
    private LinkPreviewService service;

    @BeforeEach
    void setUp() {
        fetcher = mock(PublicUrlFetcher.class);
        service = new LinkPreviewService(fetcher, new ObjectMapper());
    }

    private static PublicUrlFetcher.Response html(String url, String body) {
        return new PublicUrlFetcher.Response(URI.create(url), "text/html; charset=utf-8",
                body.getBytes(StandardCharsets.UTF_8), false);
    }

    private void page(String url, String body) {
        when(fetcher.get(argThat(u -> u != null && u.toString().equals(url)), contains("text/html"), anyInt(),
                any(Duration.class), anyString())).thenReturn(html(url, body));
    }

    @Test
    void oembedEndpoint_routesKnownProviders() {
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://www.youtube.com/watch?v=a")))
                .startsWith("https://www.youtube.com/oembed");
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://youtu.be/a")))
                .startsWith("https://www.youtube.com/oembed");
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://m.youtube.com/watch?v=a")))
                .startsWith("https://www.youtube.com/oembed");
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://www.tiktok.com/@a/video/1")))
                .startsWith("https://www.tiktok.com/oembed");
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://open.spotify.com/track/1")))
                .startsWith("https://open.spotify.com/oembed");
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://vimeo.com/1")))
                .startsWith("https://vimeo.com/api/oembed.json");
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://example.com/youtube.com"))).isNull();
        assertThat(LinkPreviewService.oembedEndpoint(URI.create("https://notyoutube.com/a"))).isNull();
    }

    @Test
    void preview_dropsTitleOnlyChallengePages() {
        page("https://www.khanacademy.org/", "<html><head><title>Client Challenge</title></head></html>");

        assertThat(service.preview("https://www.khanacademy.org/")).isEmpty();
    }

    @Test
    void preview_keepsPlainPagesWithADescription() {
        page("https://example.com/", """
                <title>Example</title><meta name="description" content="An example page">
                """);

        Optional<LinkPreviewDto> preview = service.preview("https://example.com/");

        assertThat(preview).isPresent();
        assertThat(preview.get().title()).isEqualTo("Example");
        assertThat(preview.get().description()).isEqualTo("An example page");
    }

    @Test
    void preview_sendsACrawlerUserAgent() {
        page("https://www.reddit.com/r/a/", "<meta property=\"og:title\" content=\"r/a\">");

        service.preview("https://www.reddit.com/r/a/");

        verify(fetcher).get(any(URI.class), contains("text/html"), anyInt(), any(Duration.class),
                contains("facebookexternalhit"));
    }

    @Test
    void preview_usesOembedForYoutubeWithoutFetchingThePage() {
        when(fetcher.get(argThat(u -> u != null && u.toString().startsWith("https://www.youtube.com/oembed")),
                anyString(), anyInt(), any(Duration.class), anyString()))
                .thenReturn(new PublicUrlFetcher.Response(URI.create("https://www.youtube.com/oembed"),
                        "application/json", """
                        {"title":"Lecture 1","author_name":"MIT OpenCourseWare","provider_name":"YouTube"}
                        """.getBytes(StandardCharsets.UTF_8), false));

        Optional<LinkPreviewDto> preview = service.preview("https://www.youtube.com/watch?v=abc");

        assertThat(preview).isPresent();
        assertThat(preview.get().title()).isEqualTo("Lecture 1");
        assertThat(preview.get().description()).isEqualTo("MIT OpenCourseWare");
        assertThat(preview.get().siteName()).isEqualTo("YouTube");
        verify(fetcher, never()).get(any(URI.class), contains("text/html"), anyInt(), any(Duration.class),
                anyString());
    }

    @Test
    void preview_fallsBackToThePageWhenOembedFails() {
        when(fetcher.get(argThat(u -> u != null && u.toString().startsWith("https://www.youtube.com/oembed")),
                anyString(), anyInt(), any(Duration.class), anyString()))
                .thenThrow(new BadRequestException("That link returned HTTP 404"));
        page("https://www.youtube.com/@channel", "<meta property=\"og:title\" content=\"A channel\">");

        Optional<LinkPreviewDto> preview = service.preview("https://www.youtube.com/@channel");

        assertThat(preview).isPresent();
        assertThat(preview.get().title()).isEqualTo("A channel");
    }

    @Test
    void preview_passesSmallWebpThumbnailsThrough() {
        page("https://example.com/post", """
                <meta property="og:title" content="Post">
                <meta property="og:image" content="https://cdn.example.com/a.webp">
                """);
        byte[] webp = webp(1200, 630);
        when(fetcher.get(argThat(u -> u != null && u.toString().equals("https://cdn.example.com/a.webp")),
                anyString(), anyInt(), any(Duration.class), anyString()))
                .thenReturn(new PublicUrlFetcher.Response(URI.create("https://cdn.example.com/a.webp"),
                        "image/webp", webp, false));

        Optional<LinkPreviewDto> preview = service.preview("https://example.com/post");

        assertThat(preview).isPresent();
        assertThat(preview.get().image()).startsWith("data:image/webp;base64,");
    }

    @Test
    void preview_asksImageCdnsForJpegOrPngFirst() {
        page("https://example.com/p", """
                <meta property="og:title" content="P">
                <meta property="og:image" content="https://cdn.example.com/p">
                """);

        service.preview("https://example.com/p");

        verify(fetcher).get(argThat(u -> u != null && u.toString().equals("https://cdn.example.com/p")),
                argThat(accept -> accept.startsWith("image/jpeg") && !accept.contains("avif")),
                anyInt(), any(Duration.class), anyString());
    }

    private static byte[] webp(int width, int height) {
        byte[] b = new byte[30];
        System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, b, 0, 4);
        System.arraycopy("WEBP".getBytes(StandardCharsets.US_ASCII), 0, b, 8, 4);
        System.arraycopy("VP8X".getBytes(StandardCharsets.US_ASCII), 0, b, 12, 4);
        put24(b, 24, width - 1);
        put24(b, 27, height - 1);
        return b;
    }

    private static void put24(byte[] b, int at, int value) {
        b[at] = (byte) value;
        b[at + 1] = (byte) (value >> 8);
        b[at + 2] = (byte) (value >> 16);
    }
}
