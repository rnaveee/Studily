package com.rnave.studily.bot;

import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.MessageParam;
import com.anthropic.models.messages.SearchResultBlockParam;
import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.rag.QueryRewriter.HistoryTurn;
import com.rnave.studily.rag.RetrievedChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChatPromptBuilderTest {

    private final ChatPromptBuilder builder = new ChatPromptBuilder("claude-haiku-5-5", "claude-sonnet-5-5", 2048);

    private static final List<RetrievedChunk> CHUNKS = List.of(
            new RetrievedChunk(11, 3, "Lecture 5.pdf", BankFileKind.LECTURE, true, 12, 13, "Power",
                    "P = VI. Power is the rate of energy transfer.", 0.91),
            new RetrievedChunk(42, 7, "Syllabus.docx", BankFileKind.OTHER, false, null, null, null,
                    "Assignment 2 is due October 14.", 0.55));

    @Test
    void retrievedChunksBecomeCitableSearchResultsBeforeTheQuestion() {
        MessageCreateParams params = builder.build(List.of(), CHUNKS, "What's the formula for power?", "ENSC 220",
                true);

        List<ContentBlockParam> blocks = lastUserBlocks(params);
        assertThat(blocks).hasSize(3);

        SearchResultBlockParam first = blocks.get(0).searchResult().orElseThrow();
        assertThat(first.title()).isEqualTo("Lecture 5.pdf, pp. 12-13 · Power");
        assertThat(first.source()).isEqualTo("studily:file/3#chunk-11");
        assertThat(first.citations().orElseThrow().enabled()).contains(true);

        assertThat(blocks.get(1).searchResult().orElseThrow().title()).isEqualTo("Syllabus.docx");
        assertThat(blocks.get(2).text().orElseThrow().text())
                .isEqualTo("Scope: ENSC 220\nQuestion: What's the formula for power?");
    }

    @Test
    void aQuestionWithNoSearchResultsIsTheOnlyBlock() {
        MessageCreateParams params = builder.build(List.of(), List.of(), "What is KCL?", "ENSC 220", false);

        assertThat(lastUserBlocks(params)).hasSize(1);
    }

    @Test
    void historyIsReplayedAndALeadingAssistantTurnIsDropped() {
        List<HistoryTurn> history = List.of(
                new HistoryTurn(false, "orphaned answer"),
                new HistoryTurn(true, "What is KCL?"),
                new HistoryTurn(false, "Currents into a node sum to zero."));

        MessageCreateParams params = builder.build(history, CHUNKS, "And KVL?", "ENSC 220", true);

        List<MessageParam> messages = params.messages();
        assertThat(messages).hasSize(3);
        assertThat(messages.get(0).role()).isEqualTo(MessageParam.Role.USER);
        assertThat(messages.get(0).content().string()).contains("What is KCL?");
        assertThat(messages.get(1).role()).isEqualTo(MessageParam.Role.ASSISTANT);
    }

    @Test
    void modelAndTokenLimitComeFromConfiguration() {
        MessageCreateParams params = builder.build(List.of(), CHUNKS, "Explain power", "ENSC 220", true);

        assertThat(params.model().asString()).isEqualTo("claude-haiku-5-5");
        assertThat(params.maxTokens()).isEqualTo(2048);
        assertThat(builder.model()).isEqualTo("claude-haiku-5-5");
    }

    @Test
    void theSystemPromptOnlyAddsTheNoFilesNoteWhenNothingIsSearchable() {
        String withFiles = systemText(builder.build(List.of(), CHUNKS, "Q", "ENSC 220", true));
        String withoutFiles = systemText(builder.build(List.of(), List.of(), "Q", "ENSC 220", false));

        assertThat(withFiles).isEqualTo(ChatPromptBuilder.SYSTEM_PROMPT);
        assertThat(withoutFiles).startsWith(ChatPromptBuilder.SYSTEM_PROMPT)
                .contains("No searchable files apply to this question");
    }

    @Test
    void longHistoryMessagesAreTruncated() {
        String essay = "x".repeat(ChatPromptBuilder.MAX_HISTORY_CHARS + 500);

        assertThat(ChatPromptBuilder.truncate(essay)).hasSize(ChatPromptBuilder.MAX_HISTORY_CHARS + 2);
    }

    private static List<ContentBlockParam> lastUserBlocks(MessageCreateParams params) {
        return params.messages().getLast().content().blockParams().orElseThrow();
    }

    private static String systemText(MessageCreateParams params) {
        return params.system().orElseThrow().string().orElseThrow();
    }

    @Test
    void imagesGoBeforeTheQuestionAndSwitchToTheVisionModel() {
        PracticeTutor.Photo photo = new PracticeTutor.Photo("image/png", new byte[]{(byte) 0x89, 'P', 'N', 'G'});

        var params = builder.build(List.of(), List.of(), "How do I solve this?", "all files", false,
                List.of(photo), -1, List.of());

        assertThat(params.model().asString()).isEqualTo("claude-sonnet-5-5");
        var blocks = params.messages().getLast().content().blockParams().orElseThrow();
        assertThat(blocks.getFirst().isImage()).isTrue();
        assertThat(blocks.getLast().isText()).isTrue();
    }

    @Test
    void priorImagesAttachToTheirOwnHistoryTurn() {
        PracticeTutor.Photo photo = new PracticeTutor.Photo("image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});
        var history = List.of(new HistoryTurn(true, "Solve this"),
                new HistoryTurn(false, "Part a is 3."));

        var params = builder.build(history, List.of(), "And part b?", "all files", false, List.of(), 0, List.of(photo));

        assertThat(params.model().asString()).isEqualTo("claude-sonnet-5-5");
        assertThat(params.messages().getFirst().content().blockParams().orElseThrow().getFirst().isImage()).isTrue();
        assertThat(params.messages().getLast().content().blockParams().orElseThrow())
                .noneSatisfy(block -> assertThat(block.isImage()).isTrue());
    }

    @Test
    void textOnlyStaysOnTheChatModel() {
        var params = builder.build(List.of(), List.of(), "What is KCL?", "all files", false);

        assertThat(params.model().asString()).isEqualTo("claude-haiku-5-5");
    }
}
