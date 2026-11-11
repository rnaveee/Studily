package com.rnave.studily.rag;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class VoyageClientTest {

    private HttpServer server;
    private VoyageClient voyage;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        voyage = new VoyageClient("test-key", "http://127.0.0.1:" + server.getAddress().getPort(),
                "voyage-4", "rerank-3");
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void embedDocumentsReturnsVectorsInInputOrderAndCountsTokens() {
        server.createContext("/v1/embeddings", exchange -> reply(exchange, 200,
                "{\"data\":[{\"embedding\":[0.3,0.4],\"index\":1},{\"embedding\":[0.1,0.2],\"index\":0}],"
                        + "\"usage\":{\"total_tokens\":12}}"));

        VoyageClient.Embeddings embeddings = voyage.embedDocuments(List.of("first", "second"));

        assertThat(embeddings.vectors()).hasSize(2);
        assertThat(embeddings.vectors().get(0)).containsExactly(0.1f, 0.2f);
        assertThat(embeddings.vectors().get(1)).containsExactly(0.3f, 0.4f);
        assertThat(embeddings.tokens()).isEqualTo(12);
        assertThat(embeddings.model()).isEqualTo("voyage-4");
    }

    @Test
    void rerankSortsByRelevance() {
        server.createContext("/v1/rerank", exchange -> reply(exchange, 200,
                "{\"data\":[{\"index\":0,\"relevance_score\":0.2},{\"index\":2,\"relevance_score\":0.9}],"
                        + "\"usage\":{\"total_tokens\":7}}"));

        VoyageClient.Reranked reranked = voyage.rerank("power", List.of("a", "b", "c"), 8);

        assertThat(reranked.results()).extracting(VoyageClient.Ranked::index).containsExactly(2, 0);
        assertThat(reranked.tokens()).isEqualTo(7);
        assertThat(reranked.model()).isEqualTo("rerank-3");
    }

    @Test
    void rateLimitsAreRetriedBeforeSucceeding() {
        AtomicInteger calls = new AtomicInteger();
        server.createContext("/v1/embeddings", exchange -> {
            if (calls.incrementAndGet() == 1) {
                reply(exchange, 429, "{\"detail\":\"slow down\"}");
            } else {
                reply(exchange, 200, "{\"data\":[{\"embedding\":[1.0],\"index\":0}],\"usage\":{\"total_tokens\":3}}");
            }
        });

        VoyageClient.Embedding embedding = voyage.embedQuery("power");

        assertThat(calls.get()).isEqualTo(2);
        assertThat(embedding.vector()).containsExactly(1.0f);
    }

    @Test
    void theClientIsOnlyConfiguredWithAKey() {
        assertThat(new VoyageClient("", "http://127.0.0.1:1", "voyage-4", "rerank-3").configured()).isFalse();
        assertThat(voyage.configured()).isTrue();
    }

    private static void reply(HttpExchange exchange, int status, String json) throws IOException {
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
        }
    }
}
