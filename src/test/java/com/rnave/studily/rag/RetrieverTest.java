package com.rnave.studily.rag;

import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.rag.VoyageClient.Embedding;
import com.rnave.studily.rag.VoyageClient.Ranked;
import com.rnave.studily.rag.VoyageClient.Reranked;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class RetrieverTest {

    private static final Scope SCOPE = Scope.course(1L, 3L);
    private static final float[] QUERY_VECTOR = {1f, 0f};

    private final VoyageClient voyage = mock(VoyageClient.class);
    private final ChunkStore chunkStore = mock(ChunkStore.class);
    private final AiUsageRecorder usage = mock(AiUsageRecorder.class);
    private final Retriever retriever = new Retriever(voyage, chunkStore, usage, 0.2);

    @BeforeEach
    void voyageIsConfigured() {
        when(voyage.configured()).thenReturn(true);
        when(voyage.embedModel()).thenReturn("voyage-4");
        when(voyage.rerankModel()).thenReturn("rerank-3");
        when(voyage.embedQuery("power")).thenReturn(new Embedding(QUERY_VECTOR, 5, "voyage-4"));
    }

    @Test
    void rerankOrderWinsAndWeakChunksAreDropped() {
        searchFinds(List.of(hit(10, 1, BankFileKind.LECTURE), hit(10, 2, BankFileKind.LECTURE)),
                List.of(hit(10, 2, BankFileKind.LECTURE), hit(10, 3, BankFileKind.LECTURE)));
        when(voyage.rerank(eq("power"), eq(List.of("Power\ncontent 2", "Power\ncontent 1", "Power\ncontent 3")),
                eq(8))).thenReturn(new Reranked(
                List.of(new Ranked(0, 0.9), new Ranked(2, 0.5), new Ranked(1, 0.1)), 9, "rerank-3"));

        Retriever.Retrieval result = retriever.retrieve(SCOPE, "power", 8, AiFeature.BOT_CHAT);

        assertThat(result.chunks()).extracting(RetrievedChunk::chunkId).containsExactly(2L, 3L);
        assertThat(result.chunks()).extracting(RetrievedChunk::relevance).containsExactly(0.9, 0.5);
        verify(usage).record(1L, AiFeature.BOT_CHAT, "voyage-4", 5, 0, true);
        verify(usage).record(1L, AiFeature.BOT_CHAT, "rerank-3", 9, 0, true);
    }

    @Test
    void aFailedRerankFallsBackToTheFusedOrderAndRecordsTheFailure() {
        searchFinds(List.of(hit(10, 1, BankFileKind.LECTURE), hit(10, 2, BankFileKind.LECTURE)),
                List.of(hit(10, 2, BankFileKind.LECTURE)));
        when(voyage.rerank(anyString(), anyList(), anyInt())).thenThrow(new IllegalStateException("Voyage is down"));

        Retriever.Retrieval result = retriever.retrieve(SCOPE, "power", 8, AiFeature.BOT_CHAT);

        assertThat(result.chunks()).extracting(RetrievedChunk::chunkId).containsExactly(2L, 1L);
        assertThat(result.chunks()).extracting(RetrievedChunk::relevance).containsOnlyNulls();
        verify(usage).record(1L, AiFeature.BOT_CHAT, "rerank-3", 0, 0, false);
    }

    @Test
    void noMatchesMeansNoRerankCall() {
        searchFinds(List.of(), List.of());

        Retriever.Retrieval result = retriever.retrieve(SCOPE, "power", 8, AiFeature.BOT_CHAT);

        assertThat(result.chunks()).isEmpty();
        verify(voyage, never()).rerank(anyString(), anyList(), anyInt());
    }

    @Test
    void aFailedEmbeddingFallsBackToKeywordMatchesWithoutRelevance() {
        when(voyage.embedQuery("boom")).thenThrow(new IllegalStateException("Voyage is down"));
        when(chunkStore.keywordSearch(SCOPE, "boom", 40))
                .thenReturn(List.of(hit(10, 1, BankFileKind.LECTURE), hit(10, 2, BankFileKind.LECTURE)));

        Retriever.Retrieval result = retriever.retrieve(SCOPE, "boom", 8, AiFeature.BOT_CHAT);

        assertThat(result.chunks()).extracting(RetrievedChunk::chunkId).containsExactly(1L, 2L);
        assertThat(result.chunks()).extracting(RetrievedChunk::relevance).containsOnlyNulls();
        verify(usage).record(1L, AiFeature.BOT_CHAT, "voyage-4", 0, 0, false);
        verify(chunkStore, never()).semanticSearch(any(), any(), anyInt());
        verify(voyage, never()).rerank(anyString(), anyList(), anyInt());
    }

    @Test
    void nothingIsSearchedWithoutAVoyageKey() {
        when(voyage.configured()).thenReturn(false);

        Retriever.Retrieval result = retriever.retrieve(SCOPE, "power", 8, AiFeature.BOT_CHAT);

        assertThat(result.chunks()).isEmpty();
        verify(voyage, never()).embedQuery(anyString());
        verifyNoInteractions(chunkStore);
    }

    @Test
    void sampleUsesOnlyPreferredKindsWhileTheyLastAndSpreadsAcrossFiles() {
        stubSampleFiles(Set.of(BankFileKind.LECTURE), 2);

        List<RetrievedChunk> sample = retriever.sample(SCOPE, 2, Set.of(BankFileKind.LECTURE));

        assertThat(sample).hasSize(2);
        assertThat(sample).extracting(RetrievedChunk::fileKind).containsOnly(BankFileKind.LECTURE);
        assertThat(sample).extracting(RetrievedChunk::fileId).containsExactlyInAnyOrder(10L, 30L);
        verify(voyage, never()).embedQuery(anyString());
    }

    @Test
    void preferredKindsComeFirstAndOthersFillTheRest() {
        stubSampleFiles(Set.of(BankFileKind.ASSIGNMENT), 4);

        List<RetrievedChunk> sample = retriever.sample(SCOPE, 4, Set.of(BankFileKind.ASSIGNMENT));

        assertThat(sample).hasSize(4);
        assertThat(sample.getFirst().fileKind()).isEqualTo(BankFileKind.ASSIGNMENT);
        assertThat(sample).extracting(RetrievedChunk::chunkId).containsExactlyInAnyOrder(1L, 2L, 3L, 4L);
    }

    @Test
    void withNoPreferredKindsTheSpreadStillTakesOneFromEachFile() {
        stubSampleFiles(Set.of(BankFileKind.PRACTICE_EXAM), 2);

        List<RetrievedChunk> sample = retriever.sample(SCOPE, 2, Set.of(BankFileKind.PRACTICE_EXAM));

        assertThat(sample).hasSize(2);
        assertThat(sample).extracting(RetrievedChunk::fileId).doesNotHaveDuplicates();
    }

    @Test
    void askingForNoSamplesReturnsNone() {
        assertThat(retriever.sample(SCOPE, 0, Set.of())).isEmpty();
    }

    @Test
    void aNullPreferenceIsTreatedAsNoPreference() {
        when(chunkStore.sampleFileIds(SCOPE, Set.of(), 4)).thenReturn(List.of(10L));
        when(chunkStore.randomChunksPerFile(SCOPE, List.of(10L), 2, Retriever.SAMPLE_MIN_CHARS))
                .thenReturn(List.of(hit(10, 1, BankFileKind.LECTURE), hit(10, 2, BankFileKind.LECTURE)));

        List<RetrievedChunk> sample = retriever.sample(SCOPE, 2, null);

        assertThat(sample).extracting(RetrievedChunk::chunkId).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void sampleOnlyLoadsAtMostTwiceTheCountInFiles() {
        retriever.sample(SCOPE, 3, Set.of(BankFileKind.LECTURE));

        verify(chunkStore).sampleFileIds(SCOPE, Set.of(BankFileKind.LECTURE), 6);
    }

    @Test
    void sampleWithNoReadyFilesLoadsNoChunks() {
        assertThat(retriever.sample(SCOPE, 3, Set.of())).isEmpty();

        verify(chunkStore, never()).randomChunksPerFile(any(), any(), anyInt(), anyInt());
    }

    private void stubSampleFiles(Set<BankFileKind> preferred, int count) {
        List<Long> fileIds = List.of(10L, 20L, 30L);
        when(chunkStore.sampleFileIds(SCOPE, preferred, count * 2)).thenReturn(fileIds);
        when(chunkStore.randomChunksPerFile(SCOPE, fileIds, count, Retriever.SAMPLE_MIN_CHARS))
                .thenReturn(sampleRows());
    }

    private void searchFinds(List<ChunkStore.Hit> semantic, List<ChunkStore.Hit> keyword) {
        when(chunkStore.semanticSearch(eq(SCOPE), any(), anyInt())).thenReturn(semantic);
        when(chunkStore.keywordSearch(eq(SCOPE), eq("power"), anyInt())).thenReturn(keyword);
    }

    private static List<ChunkStore.Hit> sampleRows() {
        return List.of(
                hit(10, 1, BankFileKind.LECTURE),
                hit(10, 2, BankFileKind.LECTURE),
                hit(20, 3, BankFileKind.ASSIGNMENT),
                hit(30, 4, BankFileKind.LECTURE));
    }

    private static ChunkStore.Hit hit(long fileId, long chunkId, BankFileKind kind) {
        return new ChunkStore.Hit(chunkId, fileId, "notes.pdf", kind, true, 0, 2, 2, "Power",
                "content " + chunkId, 0.5);
    }
}
