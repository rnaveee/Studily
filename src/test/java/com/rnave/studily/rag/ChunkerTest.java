package com.rnave.studily.rag;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChunkerTest {

    private final Chunker chunker = new Chunker();

    @Test
    void shortSlidesAreMergedIntoOneChunkWithTheirPageRange() {
        List<Section> slides = List.of(
                new Section("Ohm's law", "V = IR relates voltage, current and resistance.", 1),
                new Section("Power", "P = VI is the power delivered to a component.", 2),
                new Section("Combining them", "Substituting gives P = I^2 R and P = V^2 / R.", 3));

        List<Chunk> chunks = chunker.chunk(slides);

        assertThat(chunks).hasSize(1);
        Chunk chunk = chunks.getFirst();
        assertThat(chunk.heading()).isEqualTo("Ohm's law");
        assertThat(chunk.pageFrom()).isEqualTo(1);
        assertThat(chunk.pageTo()).isEqualTo(3);
        assertThat(chunk.text()).contains("Power\nP = VI", "Combining them\nSubstituting");
    }

    @Test
    void longSectionsSplitUnderTheLimitWithOverlap() {
        List<String> paragraphs = new ArrayList<>();
        for (int i = 1; i <= 12; i++) {
            paragraphs.add(("Paragraph " + i + " explains part of the lecture in detail. ").repeat(4).strip());
        }
        List<Chunk> chunks = chunker.chunk(List.of(new Section("Lecture 3", String.join("\n\n", paragraphs), 4)));

        assertThat(chunks).hasSizeGreaterThan(1);
        assertThat(chunks).allSatisfy(chunk -> assertThat(chunk.text().length()).isLessThanOrEqualTo(Chunker.MAX_CHARS));
        String firstChunk = chunks.get(0).text();
        String lastParagraphOfFirst = firstChunk.substring(firstChunk.lastIndexOf("\n\n") + 2);
        assertThat(chunks.get(1).text()).startsWith(lastParagraphOfFirst);
    }

    @Test
    void aNewHeadingStartsAFreshChunkOnceTheCurrentOneIsBigEnough() {
        String longIntro = "Kirchhoff's current law says currents into a node sum to zero. ".repeat(10);
        List<Chunk> chunks = chunker.chunk(List.of(
                new Section("KCL", longIntro, 5),
                new Section("KVL", "Voltages around any closed loop sum to zero.", 6)));

        assertThat(chunks).hasSize(2);
        assertThat(chunks.get(1).heading()).isEqualTo("KVL");
        assertThat(chunks.get(1).text()).doesNotContain("Kirchhoff's current law");
        assertThat(chunks.get(1).pageFrom()).isEqualTo(6);
    }

    @Test
    void textWithoutSentenceBreaksIsHardWrapped() {
        String wall = "word".repeat(1000);

        List<Chunk> chunks = chunker.chunk(List.of(new Section(null, wall, null)));

        assertThat(chunks).hasSizeGreaterThan(1);
        assertThat(chunks).allSatisfy(chunk -> assertThat(chunk.text().length()).isLessThanOrEqualTo(Chunker.MAX_CHARS));
        assertThat(String.join("", chunks.stream().map(Chunk::text).toList())).isEqualTo(wall);
    }

    @Test
    void chunkIndexesAreSequential() {
        String body = "A sentence about thermodynamics. ".repeat(200);

        List<Chunk> chunks = chunker.chunk(List.of(new Section("Heat", body, 1)));

        for (int i = 0; i < chunks.size(); i++) {
            assertThat(chunks.get(i).index()).isEqualTo(i);
        }
    }

    @Test
    void noSectionsMeansNoChunks() {
        assertThat(chunker.chunk(List.of())).isEmpty();
    }
}
