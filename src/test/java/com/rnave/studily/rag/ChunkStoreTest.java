package com.rnave.studily.rag;

import com.rnave.studily.rag.ChunkStore.Nearest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class ChunkStoreTest {

    @Test
    void keepsOnlyTheBestMatchesInDescendingOrder() {
        Nearest nearest = new Nearest(new float[]{1, 0}, 2);
        nearest.offer(1, new float[]{0.2f, 0.98f});
        nearest.offer(2, new float[]{1f, 0f});
        nearest.offer(3, new float[]{0.6f, 0.8f});
        nearest.offer(4, new float[]{-1f, 0f});

        assertThat(nearest.best()).extracting(Nearest.Scored::id).containsExactly(2L, 3L);
        assertThat(nearest.best().get(0).score()).isCloseTo(1.0, within(1e-6));
        assertThat(nearest.best().get(1).score()).isCloseTo(0.6, within(1e-6));
    }

    @Test
    void theQueryLengthDoesNotChangeTheScores() {
        float[] row = {0.6f, 0.8f};

        assertThat(score(new float[]{3, 4}, row)).isCloseTo(1.0, within(1e-6));
        assertThat(score(new float[]{300, 400}, row)).isCloseTo(1.0, within(1e-6));
    }

    @Test
    void aZeroQueryScoresEverythingAsZero() {
        assertThat(score(new float[]{0, 0}, new float[]{0.6f, 0.8f})).isZero();
    }

    @Test
    void equalScoresKeepTheLowerChunkId() {
        Nearest nearest = new Nearest(new float[]{1, 0}, 1);
        nearest.offer(9, new float[]{1, 0});
        nearest.offer(4, new float[]{1, 0});
        nearest.offer(7, new float[]{1, 0});

        assertThat(nearest.best()).extracting(Nearest.Scored::id).containsExactly(4L);
    }

    @Test
    void aLimitLargerThanTheCandidatesReturnsEverythingSorted() {
        Nearest nearest = new Nearest(new float[]{1, 0}, 10);
        nearest.offer(1, new float[]{0f, 1f});
        nearest.offer(2, new float[]{1f, 0f});

        assertThat(nearest.best()).extracting(Nearest.Scored::id).containsExactly(2L, 1L);
    }

    @Test
    void vectorsOfTheWrongSizeAreRejected() {
        Nearest nearest = new Nearest(new float[]{1, 0}, 2);

        assertThatThrownBy(() -> nearest.offer(1, new float[]{1f, 0f, 0f}))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aLimitBelowOneIsRejected() {
        assertThatThrownBy(() -> new Nearest(new float[]{1, 0}, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static double score(float[] query, float[] row) {
        Nearest nearest = new Nearest(query, 1);
        nearest.offer(1, row);
        return nearest.best().getFirst().score();
    }
}
