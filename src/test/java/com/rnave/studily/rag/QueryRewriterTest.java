package com.rnave.studily.rag;

import com.rnave.studily.rag.QueryRewriter.HistoryTurn;
import com.rnave.studily.rag.QueryRewriter.Rewrite;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class QueryRewriterTest {

    private final ClaudeConnection claude = mock(ClaudeConnection.class);
    private final QueryRewriter rewriter = new QueryRewriter(claude, "claude-haiku-5-5");

    @Test
    void aFirstQuestionIsSearchedAsItIsWithoutAnyModelCall() {
        Rewrite rewrite = rewriter.rewrite(List.of(), "What is Ohm's law?");

        assertThat(rewrite.query()).isEqualTo("What is Ohm's law?");
        assertThat(rewrite.model()).isNull();
        verifyNoInteractions(claude);
    }

    @Test
    void noModelCallWhenClaudeIsNotConfigured() {
        when(claude.configured()).thenReturn(false);

        Rewrite rewrite = rewriter.rewrite(List.of(new HistoryTurn(true, "Explain Thevenin")), "and its limits?");

        assertThat(rewrite.query()).isEqualTo("and its limits?");
        verify(claude, never()).client();
    }

    @Test
    void theTranscriptKeepsTheLastFourTurnsAndClipsLongOnes() {
        String longText = "x".repeat(QueryRewriter.MAX_MESSAGE_CHARS + 50);
        List<HistoryTurn> history = List.of(
                new HistoryTurn(true, "one"),
                new HistoryTurn(false, "two"),
                new HistoryTurn(true, "three"),
                new HistoryTurn(false, "four"),
                new HistoryTurn(true, longText));

        String transcript = QueryRewriter.transcript(history, "and now?");

        assertThat(transcript).doesNotContain("Student: one").contains("Assistant: two", "Student: three");
        assertThat(transcript).contains("Student: " + "x".repeat(QueryRewriter.MAX_MESSAGE_CHARS) + " …");
        assertThat(transcript).endsWith("Latest message: and now?");
    }
}
