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
                <meta property="og:image:alt" content="Studily logo" />
                <meta name="twitter:title" content="Studily: Your whole semester on one screen" />
                <meta name="twitter:description" content="Generic description" />
                <meta name="twitter:image" content="https://studily.ca/og-image.png" />
            </head>
            """;
    private static final String IMAGE = "https://studily.ca/api/public/flashcard-sets/26/preview.png?v=abc";

    private static SetPagePreview preview(String title, String description, String name, String username, int cards) {
        return new SetPagePreview(26L, title, description, name, username, cards, null, null, null);
    }

    @Test
    void replacesTitleDescriptionUrlAndImage() {
        String out = SetPageMeta.render(HTML, preview("BIOL 101 Cells", null, "Ryan", "ryan", 8),
                "https://studily.ca/sets/26", IMAGE);

        assertThat(out).contains("<title>Studily - BIOL 101 Cells by Ryan</title>");
        assertThat(out).contains("<meta property=\"og:title\" content=\"Studily - BIOL 101 Cells by Ryan\" />");
        assertThat(out).contains("<meta name=\"twitter:title\" content=\"Studily - BIOL 101 Cells by Ryan\" />");
        assertThat(out).contains("<meta property=\"og:url\" content=\"https://studily.ca/sets/26\" />");
        assertThat(out).contains("content=\"Flashcard set by Ryan (@ryan) · 8 cards. Study it free on Studily.\"");
        assertThat(out).contains("<meta property=\"og:image\" content=\"" + IMAGE + "\" />");
        assertThat(out).contains("<meta name=\"twitter:image\" content=\"" + IMAGE + "\" />");
        assertThat(out).contains("<meta property=\"og:image:alt\" content=\"BIOL 101 Cells flashcard set on Studily\" />");
        assertThat(out).doesNotContain("Generic description").doesNotContain("og-image.png");
    }

    @Test
    void fallsBackToUsernameWithoutDisplayName() {
        String out = SetPageMeta.render(HTML, preview("Cells", null, " ", "ryan", 2), "https://studily.ca/sets/26", IMAGE);

        assertThat(out).contains("<meta property=\"og:title\" content=\"Studily - Cells by @ryan\" />");
    }

    @Test
    void escapesUserText() {
        String out = SetPageMeta.render(HTML,
                preview("\"><script>alert(1)</script> $1 \\\\", "A & B", "<b>", "x", 1),
                "https://studily.ca/sets/1", IMAGE);

        assertThat(out).doesNotContain("<script>");
        assertThat(out).doesNotContain("<b>");
        assertThat(out).contains("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; $1");
        assertThat(out).contains("A &amp; B · Flashcard set by &lt;b&gt; (@x) · 1 card.");
    }

    @Test
    void keepsNonAsciiTextReadable() {
        String out = SetPageMeta.render(HTML, preview("Café 化学", null, "Zoë", "zoe", 2),
                "https://studily.ca/sets/3", IMAGE);

        assertThat(out).contains("<meta property=\"og:title\" content=\"Studily - Café 化学 by Zoë\" />");
        assertThat(out).contains("Flashcard set by Zoë (@zoe)");
    }

    @Test
    void truncatesLongDescriptions() {
        String description = SetPageMeta.describe(preview("T", "x".repeat(500), "N", "n", 3));

        assertThat(description).hasSizeLessThanOrEqualTo(300).endsWith("…");
    }
}
