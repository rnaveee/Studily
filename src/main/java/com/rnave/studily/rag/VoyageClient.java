package com.rnave.studily.rag;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Supplier;

@Component
public class VoyageClient {

    private static final Logger log = LoggerFactory.getLogger(VoyageClient.class);

    static final int DIMENSIONS = 1024;
    static final int MAX_BATCH_TEXTS = 128;
    static final int MAX_BATCH_TOKENS = 100_000;
    static final int ATTEMPTS = 4;

    private final RestClient http;
    private final String embedModel;
    private final String rerankModel;
    private final boolean configured;

    public VoyageClient(@Value("${app.rag.voyage.api-key}") String apiKey,
                        @Value("${app.rag.voyage.base-url}") String baseUrl,
                        @Value("${app.rag.voyage.embed-model}") String embedModel,
                        @Value("${app.rag.voyage.rerank-model}") String rerankModel) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        this.http = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .build();
        this.embedModel = embedModel;
        this.rerankModel = rerankModel;
        this.configured = apiKey != null && !apiKey.isBlank();
        if (!configured) {
            log.warn("VOYAGE_API_KEY not set, document indexing and StudilyBot retrieval are disabled");
        }
    }

    public boolean configured() {
        return configured;
    }

    public String embedModel() {
        return embedModel;
    }

    public String rerankModel() {
        return rerankModel;
    }

    public Embeddings embedDocuments(List<String> texts) {
        List<float[]> vectors = new ArrayList<>(texts.size());
        long tokens = 0;
        List<String> batch = new ArrayList<>();
        int batchTokens = 0;
        for (String text : texts) {
            int estimate = text.length() / 4 + 1;
            if (!batch.isEmpty() && (batch.size() == MAX_BATCH_TEXTS || batchTokens + estimate > MAX_BATCH_TOKENS)) {
                tokens += embedBatch(batch, "document", vectors);
                batch = new ArrayList<>();
                batchTokens = 0;
            }
            batch.add(text);
            batchTokens += estimate;
        }
        if (!batch.isEmpty()) {
            tokens += embedBatch(batch, "document", vectors);
        }
        return new Embeddings(vectors, tokens, embedModel);
    }

    public Embedding embedQuery(String query) {
        List<float[]> vectors = new ArrayList<>(1);
        long tokens = embedBatch(List.of(query), "query", vectors);
        return new Embedding(vectors.getFirst(), tokens, embedModel);
    }

    public Reranked rerank(String query, List<String> documents, int topK) {
        RerankResponse response = withRetry(() -> http.post()
                .uri("/v1/rerank")
                .contentType(MediaType.APPLICATION_JSON)
                .body(new RerankRequest(query, documents, rerankModel, Math.min(topK, documents.size())))
                .retrieve()
                .body(RerankResponse.class));
        List<Ranked> ranked = response.data().stream()
                .map(item -> new Ranked(item.index(), item.relevanceScore()))
                .sorted(Comparator.comparingDouble(Ranked::score).reversed())
                .toList();
        return new Reranked(ranked, response.usage().totalTokens(), rerankModel);
    }

    private long embedBatch(List<String> batch, String inputType, List<float[]> out) {
        EmbedResponse response = withRetry(() -> http.post()
                .uri("/v1/embeddings")
                .contentType(MediaType.APPLICATION_JSON)
                .body(new EmbedRequest(batch, embedModel, inputType, DIMENSIONS))
                .retrieve()
                .body(EmbedResponse.class));
        if (response.data().size() != batch.size()) {
            throw new IllegalStateException("Voyage returned " + response.data().size()
                    + " embeddings for " + batch.size() + " inputs");
        }
        response.data().stream()
                .sorted(Comparator.comparingInt(EmbedItem::index))
                .forEach(item -> out.add(item.embedding()));
        return response.usage().totalTokens();
    }

    private <T> T withRetry(Supplier<T> call) {
        RuntimeException last = null;
        for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try {
                return call.get();
            } catch (HttpClientErrorException.TooManyRequests | HttpServerErrorException | ResourceAccessException e) {
                last = e;
                if (attempt < ATTEMPTS) {
                    sleep(Duration.ofMillis(500L * (1L << attempt)));
                }
            }
        }
        throw last;
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting to retry Voyage", e);
        }
    }

    public record Embeddings(List<float[]> vectors, long tokens, String model) {
    }

    public record Embedding(float[] vector, long tokens, String model) {
    }

    public record Ranked(int index, double score) {
    }

    public record Reranked(List<Ranked> results, long tokens, String model) {
    }

    record EmbedRequest(
            List<String> input,
            String model,
            @JsonProperty("input_type") String inputType,
            @JsonProperty("output_dimension") int outputDimension) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record EmbedResponse(List<EmbedItem> data, VoyageUsage usage) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record EmbedItem(float[] embedding, int index) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record VoyageUsage(@JsonProperty("total_tokens") long totalTokens) {
    }

    record RerankRequest(
            String query,
            List<String> documents,
            String model,
            @JsonProperty("top_k") int topK) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RerankResponse(List<RerankItem> data, VoyageUsage usage) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RerankItem(int index, @JsonProperty("relevance_score") double relevanceScore) {
    }
}
