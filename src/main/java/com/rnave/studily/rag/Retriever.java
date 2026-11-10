package com.rnave.studily.rag;

import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class Retriever {

    private static final Logger log = LoggerFactory.getLogger(Retriever.class);

    static final int CANDIDATES_PER_METHOD = 40;
    static final int FUSED_CANDIDATES = 30;

    private final VoyageClient voyage;
    private final ChunkStore chunkStore;
    private final AiUsageRecorder usage;
    private final double minRelevance;

    public Retriever(VoyageClient voyage, ChunkStore chunkStore, AiUsageRecorder usage,
                     @Value("${app.rag.min-relevance}") double minRelevance) {
        this.voyage = voyage;
        this.chunkStore = chunkStore;
        this.usage = usage;
        this.minRelevance = minRelevance;
    }

    public record Retrieval(List<RetrievedChunk> chunks) {
    }

    public boolean enabled() {
        return voyage.configured();
    }

    public long readyFiles(Scope scope) {
        return chunkStore.readyFiles(scope);
    }

    public Retrieval retrieve(Scope scope, String query, int topK, AiFeature feature) {
        if (!enabled()) {
            return new Retrieval(List.of());
        }
        float[] vector = embedQuery(scope, query, feature);
        List<ChunkStore.Hit> semantic = chunkStore.semanticSearch(scope, vector, CANDIDATES_PER_METHOD);
        List<ChunkStore.Hit> keyword = chunkStore.keywordSearch(scope, query, CANDIDATES_PER_METHOD);
        List<ChunkStore.Hit> fused = Rrf.fuse(List.of(semantic, keyword), ChunkStore.Hit::chunkId,
                Math.max(FUSED_CANDIDATES, topK));
        if (fused.isEmpty()) {
            return new Retrieval(List.of());
        }

        List<String> documents = fused.stream().map(Retriever::rerankText).toList();
        VoyageClient.Reranked reranked;
        try {
            reranked = voyage.rerank(query, documents, topK);
        } catch (RuntimeException e) {
            log.warn("Rerank failed, falling back to fused order: {}", e.getMessage());
            usage.record(scope.userId(), feature, voyage.rerankModel(), 0, 0, false);
            return new Retrieval(fused.stream().limit(topK).map(hit -> RetrievedChunk.of(hit, null)).toList());
        }
        usage.record(scope.userId(), feature, reranked.model(), reranked.tokens(), 0, true);
        List<RetrievedChunk> chunks = reranked.results().stream()
                .filter(result -> result.score() >= minRelevance)
                .map(result -> RetrievedChunk.of(fused.get(result.index()), result.score()))
                .toList();
        return new Retrieval(chunks);
    }

    public List<RetrievedChunk> sample(Scope scope, int count, Set<BankFileKind> preferKinds) {
        if (count <= 0) {
            return List.of();
        }
        Map<Long, List<ChunkStore.Hit>> byFile = new LinkedHashMap<>();
        for (ChunkStore.Hit hit : chunkStore.randomChunksPerFile(scope, count)) {
            byFile.computeIfAbsent(hit.fileId(), id -> new ArrayList<>()).add(hit);
        }
        List<List<ChunkStore.Hit>> files = new ArrayList<>(byFile.values());
        Collections.shuffle(files);
        List<List<ChunkStore.Hit>> preferred = files.stream()
                .filter(file -> preferKinds.contains(file.getFirst().fileKind()))
                .toList();
        List<List<ChunkStore.Hit>> others = files.stream()
                .filter(file -> !preferKinds.contains(file.getFirst().fileKind()))
                .toList();
        List<RetrievedChunk> picked = new ArrayList<>(count);
        spread(preferred, count, picked);
        spread(others, count, picked);
        return picked;
    }

    private float[] embedQuery(Scope scope, String query, AiFeature feature) {
        VoyageClient.Embedding embedding;
        try {
            embedding = voyage.embedQuery(query);
        } catch (RuntimeException e) {
            usage.record(scope.userId(), feature, voyage.embedModel(), 0, 0, false);
            throw e;
        }
        usage.record(scope.userId(), feature, embedding.model(), embedding.tokens(), 0, true);
        return embedding.vector();
    }

    private static void spread(List<List<ChunkStore.Hit>> files, int count, List<RetrievedChunk> out) {
        List<Iterator<ChunkStore.Hit>> cursors = files.stream().map(List::iterator).toList();
        boolean progressed = true;
        while (out.size() < count && progressed) {
            progressed = false;
            for (Iterator<ChunkStore.Hit> cursor : cursors) {
                if (out.size() >= count) {
                    break;
                }
                if (cursor.hasNext()) {
                    out.add(RetrievedChunk.of(cursor.next(), null));
                    progressed = true;
                }
            }
        }
    }

    static String rerankText(ChunkStore.Hit hit) {
        return hit.heading() == null ? hit.content() : hit.heading() + "\n" + hit.content();
    }
}
