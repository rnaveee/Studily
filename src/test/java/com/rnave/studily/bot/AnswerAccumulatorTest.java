package com.rnave.studily.bot;

import com.anthropic.core.ObjectMappers;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.models.messages.StopReason;
import com.rnave.studily.bot.BotDtos.CitationDto;
import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.rag.RetrievedChunk;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AnswerAccumulatorTest {

    private static final List<RetrievedChunk> CHUNKS = List.of(
            new RetrievedChunk(11, 3, "Lecture 5.pdf", BankFileKind.LECTURE, true, 12, 12, "Power", "P = VI", 0.9));

    @Test
    void streamsTextAndAttachesCitationsToTheirBlock() throws Exception {
        AnswerAccumulator answer = new AnswerAccumulator(CHUNKS);
        List<String> pieces = new ArrayList<>();

        for (String json : List.of(
                """
                {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant",
                 "model":"claude-haiku-5-5","content":[],"stop_reason":null,"stop_sequence":null,
                 "usage":{"input_tokens":1200,"output_tokens":1,"cache_read_input_tokens":0,
                          "cache_creation_input_tokens":0}}}""",
                """
                {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}""",
                citationDelta(0, "P = VI"),
                """
                {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Power is "}}""",
                """
                {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"P = VI."}}""",
                """
                {"type":"content_block_stop","index":0}""",
                """
                {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},
                 "usage":{"output_tokens":42}}""",
                """
                {"type":"message_stop"}""")) {
            pieces.addAll(answer.accept(event(json)));
        }

        assertThat(answer.text()).isEqualTo("Power is P = VI.");
        assertThat(pieces).containsExactly("Power is ", "P = VI.");
        assertThat(answer.citations()).containsExactly(
                new CitationDto(0, 3, "Lecture 5.pdf", 12, 12, "P = VI", true));
        assertThat(answer.stopReason()).isEqualTo(StopReason.END_TURN);
        assertThat(answer.inputTokens()).isEqualTo(1200);
        assertThat(answer.outputTokens()).isEqualTo(42);
        assertThat(answer.model()).isEqualTo("claude-haiku-5-5");
    }

    @Test
    void repeatedCitationsOfTheSameTextAreKeptOnce() throws Exception {
        AnswerAccumulator answer = new AnswerAccumulator(CHUNKS);
        answer.accept(event(textBlockStart()));
        answer.accept(event(citationDelta(0, "P = VI")));
        answer.accept(event(citationDelta(0, "P = VI")));
        answer.accept(event(citationDelta(0, "rate of energy")));
        answer.accept(event("""
                {"type":"content_block_stop","index":0}"""));

        assertThat(answer.citations()).extracting(CitationDto::quote).containsExactly("P = VI", "rate of energy");
    }

    @Test
    void citationsPointingOutsideTheSourcesAreIgnored() throws Exception {
        AnswerAccumulator answer = new AnswerAccumulator(CHUNKS);
        answer.accept(event(textBlockStart()));
        answer.accept(event(citationDelta(5, "x")));
        answer.accept(event("""
                {"type":"content_block_stop","index":0}"""));

        assertThat(answer.citations()).isEmpty();
    }

    @Test
    void outputTokensFallBackToAnEstimateWhenTheStreamIsCutShort() throws Exception {
        AnswerAccumulator answer = new AnswerAccumulator(CHUNKS);
        answer.accept(event(textBlockStart()));
        answer.accept(event("""
                {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"%s"}}"""
                .formatted("a".repeat(400))));

        assertThat(answer.stopReason()).isNull();
        assertThat(answer.outputTokens()).isEqualTo(100);
    }

    private static String textBlockStart() {
        return """
                {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}""";
    }

    private static String citationDelta(int searchResultIndex, String citedText) {
        return """
                {"type":"content_block_delta","index":0,"delta":{"type":"citations_delta","citation":{
                 "type":"search_result_location","source":"studily:file/3#chunk-11","title":"Lecture 5.pdf, p. 12",
                 "cited_text":"%s","search_result_index":%d,"start_block_index":0,"end_block_index":1}}}"""
                .formatted(citedText, searchResultIndex);
    }

    private static RawMessageStreamEvent event(String json) throws Exception {
        return ObjectMappers.jsonMapper().readValue(json, RawMessageStreamEvent.class);
    }
}
