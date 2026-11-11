package com.rnave.studily.bot;

import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlock;
import com.anthropic.models.messages.Usage;
import com.rnave.studily.bot.BotDtos.ProblemSecret;
import com.rnave.studily.bot.BotDtos.Verdict;
import com.rnave.studily.bot.PracticeTutor.Excerpt;
import com.rnave.studily.bot.PracticeTutor.GradeDraft;
import com.rnave.studily.bot.PracticeTutor.Intent;
import com.rnave.studily.bot.PracticeTutor.Outcome;
import com.rnave.studily.bot.PracticeTutor.ProblemDraft;
import com.rnave.studily.rag.ClaudeConnection;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PracticeTutorTest {

    private static Message response(StopReason stop, String json) {
        Usage usage = mock(Usage.class);
        when(usage.inputTokens()).thenReturn(1_000L);
        when(usage.cacheReadInputTokens()).thenReturn(Optional.of(500L));
        when(usage.cacheCreationInputTokens()).thenReturn(Optional.empty());
        when(usage.outputTokens()).thenReturn(200L);
        Message message = mock(Message.class);
        when(message.usage()).thenReturn(usage);
        when(message.stopReason()).thenReturn(Optional.ofNullable(stop));
        List<ContentBlock> content = new ArrayList<>();
        if (json != null) {
            TextBlock text = mock(TextBlock.class);
            when(text.text()).thenReturn(json);
            ContentBlock block = mock(ContentBlock.class);
            when(block.text()).thenReturn(Optional.of(text));
            content.add(block);
        }
        when(message.content()).thenReturn(content);
        return message;
    }

    private static PracticeTutor tutor(ClaudeConnection connection, boolean enabled) {
        return new PracticeTutor(connection, enabled, "problem-model", "grade-model", "vision-model");
    }

    @Test
    void enabled_needsTheBotFlagAndAConfiguredKey() {
        ClaudeConnection connection = mock(ClaudeConnection.class);
        when(connection.configured()).thenReturn(true);
        assertThat(tutor(connection, true).enabled()).isTrue();
        assertThat(tutor(connection, false).enabled()).isFalse();

        when(connection.configured()).thenReturn(false);
        assertThat(tutor(connection, true).enabled()).isFalse();
    }

    @Test
    void read_parsesAProblemAndCountsCachedInputTokens() {
        String json = """
                {"statement":"A cart rolls down a ramp.","solution":"Use F = ma.","finalAnswer":"4 N",
                 "fromClass":true,"sourceIndexes":[2],"extra":"ignored"}""";

        Outcome<ProblemDraft> outcome = PracticeTutor.read(response(StopReason.END_TURN, json), "m",
                ProblemDraft.class);

        assertThat(outcome.ok()).isTrue();
        assertThat(outcome.inputTokens()).isEqualTo(1_500);
        assertThat(outcome.outputTokens()).isEqualTo(200);
        assertThat(outcome.result().finalAnswer()).isEqualTo("4 N");
        assertThat(outcome.result().fromClass()).isTrue();
        assertThat(outcome.result().sourceIndexes()).containsExactly(2);
    }

    @Test
    void read_parsesAGradeForAQuestion() {
        String json = """
                {"intent":"QUESTION","verdict":"INCORRECT","feedback":"","steps":[]}""";

        Outcome<GradeDraft> outcome = PracticeTutor.read(response(StopReason.END_TURN, json), "m",
                GradeDraft.class);

        assertThat(outcome.ok()).isTrue();
        assertThat(outcome.result().intent()).isEqualTo(Intent.QUESTION);
        assertThat(outcome.result().verdict()).isEqualTo(Verdict.INCORRECT);
    }

    @Test
    void read_failsButStillBillsRefusalsMaxTokensBadJsonAndEmptyReplies() {
        List<Outcome<GradeDraft>> outcomes = List.of(
                PracticeTutor.read(response(StopReason.REFUSAL, "{}"), "m", GradeDraft.class),
                PracticeTutor.read(response(StopReason.MAX_TOKENS, "{\"intent"), "m", GradeDraft.class),
                PracticeTutor.read(response(StopReason.END_TURN, "not json"), "m", GradeDraft.class),
                PracticeTutor.read(response(StopReason.END_TURN, null), "m", GradeDraft.class));

        assertThat(outcomes).allSatisfy(outcome -> {
            assertThat(outcome.ok()).isFalse();
            assertThat(outcome.inputTokens()).isEqualTo(1_500);
        });
    }

    @Test
    void problemRequest_numbersTheExcerptsAndFencesTheTopicAndEarlierProblems() {
        List<Excerpt> excerpts = List.of(new Excerpt(1, "Lecture 8.pdf, p. 12", "Torque is r times F."));

        String request = PracticeTutor.problemRequest(Difficulty.CLASS, "moments", excerpts,
                List.of("Old\nproblem"));

        assertThat(request)
                .contains("CLASS, reproduce or closely adapt", "<topic>moments</topic>", "<excerpts>",
                        "[1] Lecture 8.pdf, p. 12", "Torque is r times F.", "<earlier_problems>", "- Old problem");
    }

    @Test
    void problemRequest_omitsTheTopicAndEarlierBlocksWhenThereAreNone() {
        String request = PracticeTutor.problemRequest(Difficulty.EASY, null, List.of(), List.of());

        assertThat(request).doesNotContain("<topic>", "<earlier_problems>").contains("EASY, one step");
    }

    @Test
    void gradeRequest_carriesTheReferenceAndMarksAPhoto() {
        String request = PracticeTutor.gradeRequest("Find the force.", new ProblemSecret("F = ma", "4 N"), null,
                true);

        assertThat(request)
                .contains("<reference_final_answer>4 N</reference_final_answer>", "<student_text>\n(none)",
                        "photo of their work");
    }
}
