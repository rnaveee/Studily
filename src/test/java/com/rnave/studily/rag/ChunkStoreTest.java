package com.rnave.studily.rag;

import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.rag.ChunkStore.Nearest;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.transaction.PlatformTransactionManager;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Semaphore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ChunkStoreTest {

    @Test
    void aStoredVectorIsScoredByItsOwnLength() {
        assertThat(score(new float[]{1, 0}, new float[]{3, 4})).isCloseTo(0.6, within(1e-6));
    }

    @Test
    void aZeroStoredVectorScoresZero() {
        assertThat(score(new float[]{1, 0}, new float[]{0, 0})).isZero();
    }

    @Test
    void unitNormalisesToLengthOne() {
        float[] unit = ChunkStore.unit(new float[]{3, 4});

        assertThat(unit[0]).isCloseTo(0.6f, within(1e-6f));
        assertThat(unit[1]).isCloseTo(0.8f, within(1e-6f));
        assertThat(ChunkStore.unit(new float[]{0, 0})).containsExactly(0f, 0f);
    }

    @Test
    void completeFileStoresEveryVectorAsUnitLength() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ChunkStore store = new ChunkStore(jdbc, mock(PlatformTransactionManager.class));
        Chunk chunk = new Chunk(0, "Power", 1, 1, "Power is the rate of doing work, measured in watts.");

        store.completeFile(1L, 2L, 3L, null, List.of(chunk), List.<float[]>of(new float[]{3, 4}), 1, "voyage-4", null);

        ArgumentCaptor<BatchPreparedStatementSetter> setter = ArgumentCaptor.forClass(BatchPreparedStatementSetter.class);
        verify(jdbc).batchUpdate(anyString(), setter.capture());
        PreparedStatement statement = mock(PreparedStatement.class);
        Connection connection = mock(Connection.class);
        when(statement.getConnection()).thenReturn(connection);
        setter.getValue().setValues(statement, 0);
        ArgumentCaptor<Object[]> elements = ArgumentCaptor.forClass(Object[].class);
        verify(connection).createArrayOf(eq("float4"), elements.capture());
        assertThat(((Float) elements.getValue()[0]).doubleValue()).isCloseTo(0.6, within(1e-6));
        assertThat(((Float) elements.getValue()[1]).doubleValue()).isCloseTo(0.8, within(1e-6));
    }

    @Test
    void aBusyStoreRefusesTheSearchWithoutTouchingTheDatabase() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ChunkStore store = new ChunkStore(jdbc, mock(PlatformTransactionManager.class),
                new Semaphore(0, true), Duration.ofMillis(10));

        assertThatThrownBy(() -> store.semanticSearch(Scope.course(1L, 3L), new float[]{1, 0}, 5))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("StudilyBot is busy, try again in a moment.");
        verifyNoInteractions(jdbc);
    }

    @Test
    void aScanReleasesItsPermitEvenWhenItFails() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doThrow(new IllegalStateException("db down")).when(jdbc)
                .query(any(PreparedStatementCreator.class), any(RowCallbackHandler.class));
        Semaphore permits = new Semaphore(1, true);
        ChunkStore store = new ChunkStore(jdbc, mock(PlatformTransactionManager.class), permits, Duration.ofMillis(10));

        assertThatThrownBy(() -> store.semanticSearch(Scope.course(1L, 3L), new float[]{1, 0}, 5))
                .isInstanceOf(IllegalStateException.class);
        assertThat(permits.availablePermits()).isEqualTo(1);
    }

    @Test
    void theScanNeverRunsAgainstAnEmptyFileList() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ChunkStore store = new ChunkStore(jdbc, mock(PlatformTransactionManager.class));

        assertThat(store.randomChunksPerFile(Scope.course(1L, 3L), List.of(), 2, 200)).isEmpty();
        verifyNoInteractions(jdbc);
    }

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
