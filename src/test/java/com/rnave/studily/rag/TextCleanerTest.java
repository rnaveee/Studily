package com.rnave.studily.rag;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TextCleanerTest {

    @Test
    void normalizeRejoinsHyphenatedWordsAndTidiesWhitespace() {
        String raw = "The electro-\nmagnetic   spectrum\r\n\r\n\r\n\r\nis   wide.  \nEnd";

        assertThat(TextCleaner.normalize(raw)).isEqualTo("The electromagnetic spectrum\n\nis wide.\nEnd");
    }

    @Test
    void repeatedHeadersAndFootersAreRemoved() {
        List<String> topics = List.of("resistors", "capacitors", "inductors", "diodes", "transistors");
        List<String> pages = new ArrayList<>();
        for (int page = 1; page <= 5; page++) {
            pages.add("ENSC 204 Fall 2026\nThis page covers " + topics.get(page - 1) + ".\nPage " + page + " of 5");
        }

        List<String> cleaned = TextCleaner.removeRepeatedEdges(pages);

        assertThat(cleaned).allSatisfy(page -> {
            assertThat(page).doesNotContain("ENSC 204 Fall 2026");
            assertThat(page).doesNotContain("of 5");
        });
        assertThat(cleaned.get(2)).contains("This page covers inductors.");
    }

    @Test
    void shortDocumentsAreLeftAlone() {
        List<String> pages = List.of("Header\nBody one", "Header\nBody two");

        assertThat(TextCleaner.removeRepeatedEdges(pages)).isEqualTo(pages);
    }
}
