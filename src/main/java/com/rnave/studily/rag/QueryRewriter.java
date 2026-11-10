package com.rnave.studily.rag;

import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class QueryRewriter {

    private static final Logger log = LoggerFactory.getLogger(QueryRewriter.class);

    static final int HISTORY_MESSAGES = 4;
    static final int MAX_MESSAGE_CHARS = 600;
    static final int MAX_QUERY_CHARS = 300;

    static final String SYSTEM_PROMPT = """
            You rewrite a student's latest chat message as one standalone search query for their course files. \
            Use the earlier conversation to resolve words like "it", "that" or "the second one", and keep the \
            course's own terms. Reply with only the query: no quotes, labels or explanation. If the latest \
            message already stands on its own, repeat it unchanged.""";

    private final ClaudeConnection claude;
    private final String model;

    public QueryRewriter(ClaudeConnection claude, @Value("${app.rag.rewrite-model}") String model) {
        this.claude = claude;
        this.model = model;
    }

    public record HistoryTurn(boolean user, String text) {
    }

    public record Rewrite(String query, String model, long inputTokens, long outputTokens) {
    }

    public Rewrite rewrite(List<HistoryTurn> history, String question) {
        if (history.isEmpty() || !claude.configured()) {
            return new Rewrite(question, null, 0, 0);
        }
        MessageCreateParams params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(200L)
                .system(SYSTEM_PROMPT)
                .addUserMessage(transcript(history, question))
                .build();
        try {
            Message response = claude.client().messages().create(params);
            String query = response.content().stream()
                    .flatMap(block -> block.text().stream())
                    .map(text -> text.text().strip())
                    .findFirst()
                    .orElse("");
            if (query.isBlank() || query.length() > MAX_QUERY_CHARS) {
                query = question;
            }
            return new Rewrite(query, model, response.usage().inputTokens(), response.usage().outputTokens());
        } catch (RuntimeException e) {
            log.warn("Query rewrite failed, searching with the raw question: {}", e.getMessage());
            return new Rewrite(question, null, 0, 0);
        }
    }

    static String transcript(List<HistoryTurn> history, String question) {
        StringBuilder out = new StringBuilder("Conversation so far:\n");
        List<HistoryTurn> recent = history.subList(Math.max(0, history.size() - HISTORY_MESSAGES), history.size());
        for (HistoryTurn turn : recent) {
            String text = turn.text();
            if (text.length() > MAX_MESSAGE_CHARS) {
                text = text.substring(0, MAX_MESSAGE_CHARS) + " …";
            }
            out.append(turn.user() ? "Student: " : "Assistant: ").append(text).append("\n\n");
        }
        return out.append("Latest message: ").append(question).toString();
    }
}
