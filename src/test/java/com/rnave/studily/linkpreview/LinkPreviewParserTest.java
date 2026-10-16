package com.rnave.studily.linkpreview;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class LinkPreviewParserTest {

    private static final URI BASE = URI.create("https://www.example.com/articles/one");

    @Test
    void parse_prefersOpenGraphTags() {
        LinkPreviewParser.Meta meta = LinkPreviewParser.parse("""
                <html><head>
                  <title>Plain title</title>
                  <meta property="og:title" content="OG title">
                  <meta property="og:description" content="OG description">
                  <meta property="og:site_name" content="Example News">
                  <meta property="og:image" content="https://cdn.example.com/a.jpg">
                  <meta name="description" content="Plain description">
                </head></html>
                """, BASE);

        assertThat(meta.title()).isEqualTo("OG title");
        assertThat(meta.description()).isEqualTo("OG description");
        assertThat(meta.siteName()).isEqualTo("Example News");
        assertThat(meta.imageUrl()).isEqualTo("https://cdn.example.com/a.jpg");
    }

    @Test
    void parse_fallsBackToTitleDescriptionAndHost() {
        LinkPreviewParser.Meta meta = LinkPreviewParser.parse("""
                <html><head>
                  <title>  Plain
                     title </title>
                  <meta name="Description" content="Plain description">
                </head></html>
                """, BASE);

        assertThat(meta.title()).isEqualTo("Plain title");
        assertThat(meta.description()).isEqualTo("Plain description");
        assertThat(meta.siteName()).isEqualTo("example.com");
        assertThat(meta.imageUrl()).isNull();
    }

    @Test
    void parse_usesTwitterTagsWhenOpenGraphMissing() {
        LinkPreviewParser.Meta meta = LinkPreviewParser.parse("""
                <html><head>
                  <meta name="twitter:title" content="Tweet title">
                  <meta name="twitter:description" content="Tweet description">
                  <meta name="twitter:image" content="/img/card.png">
                </head></html>
                """, BASE);

        assertThat(meta.title()).isEqualTo("Tweet title");
        assertThat(meta.description()).isEqualTo("Tweet description");
        assertThat(meta.imageUrl()).isEqualTo("https://www.example.com/img/card.png");
    }

    @Test
    void parse_resolvesRelativeImagesAndRejectsOtherSchemes() {
        LinkPreviewParser.Meta relative = LinkPreviewParser.parse(
                "<meta property=\"og:image\" content=\"cover.jpg\">", BASE);
        LinkPreviewParser.Meta script = LinkPreviewParser.parse(
                "<meta property=\"og:image\" content=\"javascript:alert(1)\">", BASE);
        LinkPreviewParser.Meta data = LinkPreviewParser.parse(
                "<meta property=\"og:image\" content=\"data:image/png;base64,AAAA\">", BASE);

        assertThat(relative.imageUrl()).isEqualTo("https://www.example.com/articles/cover.jpg");
        assertThat(script.imageUrl()).isNull();
        assertThat(data.imageUrl()).isNull();
    }

    @Test
    void parse_clipsLongText() {
        String longTitle = "a".repeat(500);
        LinkPreviewParser.Meta meta = LinkPreviewParser.parse(
                "<meta property=\"og:title\" content=\"" + longTitle + "\">", BASE);

        assertThat(meta.title()).hasSize(200).endsWith("…");
    }

    @Test
    void parse_decodesEntities() {
        LinkPreviewParser.Meta meta = LinkPreviewParser.parse(
                "<meta property=\"og:title\" content=\"Tom &amp; Jerry &#8212; Cartoons\">", BASE);

        assertThat(meta.title()).isEqualTo("Tom & Jerry — Cartoons");
    }

    @Test
    void parse_flagsWhetherSocialTagsWereFound() {
        LinkPreviewParser.Meta og = LinkPreviewParser.parse(
                "<meta property=\"og:title\" content=\"A\">", BASE);
        LinkPreviewParser.Meta twitter = LinkPreviewParser.parse(
                "<meta name=\"Twitter:Card\" content=\"summary\"><title>A</title>", BASE);
        LinkPreviewParser.Meta plain = LinkPreviewParser.parse(
                "<title>Client Challenge</title>", BASE);

        assertThat(og.social()).isTrue();
        assertThat(twitter.social()).isTrue();
        assertThat(plain.social()).isFalse();
        assertThat(plain.description()).isNull();
    }

    @Test
    void parseOembed_mapsTitleAuthorProviderAndThumbnail() {
        URI video = URI.create("https://www.youtube.com/watch?v=abc");
        LinkPreviewParser.Meta meta = LinkPreviewParser.parseOembed(new ObjectMapper().readTree("""
                {"title":"Never Gonna Give You Up","author_name":"Rick Astley","provider_name":"YouTube",
                 "thumbnail_url":"https://i.ytimg.com/vi/abc/hqdefault.jpg","width":200}
                """), video);

        assertThat(meta.title()).isEqualTo("Never Gonna Give You Up");
        assertThat(meta.description()).isEqualTo("Rick Astley");
        assertThat(meta.siteName()).isEqualTo("YouTube");
        assertThat(meta.imageUrl()).isEqualTo("https://i.ytimg.com/vi/abc/hqdefault.jpg");
        assertThat(meta.social()).isTrue();
    }

    @Test
    void parseOembed_prefersDescriptionAndFallsBackToHost() {
        URI clip = URI.create("https://vimeo.com/1");
        LinkPreviewParser.Meta meta = LinkPreviewParser.parseOembed(new ObjectMapper().readTree("""
                {"title":"Clip","description":"About the clip","author_name":"Someone","thumbnail_url":7}
                """), clip);

        assertThat(meta.description()).isEqualTo("About the clip");
        assertThat(meta.siteName()).isEqualTo("vimeo.com");
        assertThat(meta.imageUrl()).isNull();
    }
}
