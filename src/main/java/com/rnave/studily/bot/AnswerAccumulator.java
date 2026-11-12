package com.rnave.studily.bot;

import com.anthropic.models.messages.CitationsSearchResultLocation;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.Usage;
import com.rnave.studily.bot.BotDtos.CitationDto;
import com.rnave.studily.rag.RetrievedChunk;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

final class AnswerAccumulator {

    private final List<RetrievedChunk> chunks;
    private final StringBuilder text = new StringBuilder();
    private final List<CitationDto> citations = new ArrayList<>();
    private final List<CitationsSearchResultLocation> pending = new ArrayList<>();
    private boolean inTextBlock;
    private long inputTokens;
    private long outputTokens;
    private String model;
    private StopReason stopReason;

    AnswerAccumulator(List<RetrievedChunk> chunks) {
        this.chunks = chunks;
    }

    List<String> accept(RawMessageStreamEvent event) {
        List<String> pieces = new ArrayList<>(1);

        event.messageStart().ifPresent(start -> {
            Usage usage = start.message().usage();
            inputTokens = usage.inputTokens();
            model = start.message().model().asString();
        });

        event.contentBlockStart().ifPresent(start -> {
            if (start.contentBlock().isText()) {
                inTextBlock = true;
                pending.clear();
            }
        });

        event.contentBlockDelta().ifPresent(delta -> {
            delta.delta().text().ifPresent(piece -> {
                text.append(piece.text());
                pieces.add(piece.text());
            });
            delta.delta().citations().ifPresent(citation ->
                    citation.citation().searchResultLocation().ifPresent(pending::add));
        });

        event.contentBlockStop().ifPresent(stop -> {
            if (!inTextBlock) {
                return;
            }
            for (CitationsSearchResultLocation location : pending) {
                int index = (int) location.searchResultIndex();
                if (index < 0 || index >= chunks.size()) {
                    continue;
                }
                CitationDto citation = toCitation(index, location.citedText(), text.length());
                boolean seen = citations.stream()
                        .anyMatch(c -> c.index() == citation.index() && Objects.equals(c.quote(), citation.quote()));
                if (!seen) {
                    citations.add(citation);
                }
            }
            pending.clear();
            inTextBlock = false;
        });

        event.messageDelta().ifPresent(delta -> {
            delta.delta().stopReason().ifPresent(reason -> stopReason = reason);
            outputTokens = delta.usage().outputTokens();
        });

        return pieces;
    }

    private CitationDto toCitation(int index, String citedText, int offset) {
        RetrievedChunk chunk = chunks.get(index);
        return new CitationDto(index, chunk.fileId(), chunk.fileName(), chunk.pageFrom(), chunk.pageTo(),
                citedText, chunk.previewable(), offset);
    }

    String text() {
        return text.toString();
    }

    List<CitationDto> citations() {
        return List.copyOf(citations);
    }

    StopReason stopReason() {
        return stopReason;
    }

    String model() {
        return model;
    }

    long inputTokens() {
        return inputTokens;
    }

    long outputTokens() {
        return outputTokens > 0 ? outputTokens : text.length() / 4;
    }
}
