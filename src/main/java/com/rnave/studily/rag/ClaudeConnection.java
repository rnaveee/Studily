package com.rnave.studily.rag;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class ClaudeConnection {

    private static final Logger log = LoggerFactory.getLogger(ClaudeConnection.class);

    private final String apiKey;
    private volatile AnthropicClient client;

    public ClaudeConnection(@Value("${app.parse.api-key}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        if (this.apiKey.isEmpty()) {
            log.warn("ANTHROPIC_API_KEY not set, StudilyBot answers are disabled");
        }
    }

    public boolean configured() {
        return !apiKey.isEmpty();
    }

    public AnthropicClient client() {
        AnthropicClient existing = client;
        if (existing != null) {
            return existing;
        }
        synchronized (this) {
            if (client == null) {
                client = AnthropicOkHttpClient.builder()
                        .apiKey(apiKey)
                        .timeout(Duration.ofSeconds(150))
                        .maxRetries(1)
                        .build();
            }
            return client;
        }
    }
}
