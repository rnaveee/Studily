package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.SetPagePreview;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SetPageMetaTest {

    private static final String HTML = """
            <head>
                <title>Studily: Your whole semester on one screen</title>
                <meta name="description" content="Generic description" />
                <meta property="og:title" content="Studily: Your whole semester on one screen" />
                <meta property="og:description" content="Generic description" />
                <meta property="og:url" content="https://studily.ca" />
                <meta property="og:image" content="https://studily.ca/og-image.png" />
                <meta name="twitter:title" content="Studily: Your whole semester on one screen" />
                <meta name="twitter:description" content="Generic description" />
            </head>
            """;

    @Test
    void replacesTitleDescriptionAndUrl() {
        String out = SetPageMeta.render(HTML, new SetPagePreview("BIOL 101 Cells", null, "Ryan", "ryan", 8),
                "https://studily.ca/sets/26");

        assertThat(out).contains("<title>BIOL 101 Cells · Studily</title>");
        assertThat(out).contains("<meta property=\"og:title\" content=\"BIOL 101 Cells\" />");
        assertThat(out).contains("<meta name=\"twitter:title\" content=\"BIOL 101 Cells\" />");
        assertThat(out).contains("<meta property=\"og:url\" content=\"https://studily.ca/sets/26\" />");
        assertThat(out).contains("content=\"Flashcard set by Ryan (@ryan) · 8 cards. Study it free on Studily.\"");
        assertThat(out).contains("<meta property=\"og:image\" content=\"https://studily.ca/og-image.png\" />");
        assertThat(out).doesNotContain("Generic description");
    }

    @Test
    void escapesUserText() {
        String out = SetPageMeta.render(HTML,
                new SetPagePreview("\"><script>alert(1)</script> $1 \\\\", "A & B", "<b>", "x", 1),
                "https://studily.ca/sets/1");

        assertThat(out).doesNotContain("<script>");
        assertThat(out).doesNotContain("<b>");
        assertThat(out).contains("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; $1");
        assertThat(out).contains("A &amp; B · Flashcard set by &lt;b&gt; (@x) · 1 card.");
    }

    @Test
    void keepsNonAsciiTextReadable() {
        String out = SetPageMeta.render(HTML, new SetPagePreview("Café 化学", null, "Zoë", "zoe", 2),
                "https://studily.ca/sets/3");

        assertThat(out).contains("<meta property=\"og:title\" content=\"Café 化学\" />");
        assertThat(out).contains("Flashcard set by Zoë (@zoe)");
    }

    @Test
    void truncatesLongDescriptions() {
        String description = SetPageMeta.describe(new SetPagePreview("T", "x".repeat(500), "N", "n", 3));

        assertThat(description).hasSizeLessThanOrEqualTo(300).endsWith("…");
    }
}
