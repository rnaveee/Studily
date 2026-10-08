package com.rnave.studily.flashcard;

import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class FlashcardRunDtos {

    public enum XpReason {
        FULL,
        REDUCED,
        REPEAT,
        DAILY_CAP,
        TOO_FAST,
        TOO_FEW
    }

    public record StartRunRequest(@NotNull FlashcardRunMode mode) {
    }

    public record FlashcardRunStart(Long runId, Instant startedAt) {
    }

    public record CardResult(@NotNull Long cardId, boolean correct) {
    }

    public record CompleteRunRequest(@Valid @Size(max = 500) List<@NotNull CardResult> results) {
    }

    public record RunCardDto(Long cardId, String front, String back, boolean correct) {
    }

    public record FlashcardRunResult(
            Long runId,
            FlashcardRunMode mode,
            int cardCount,
            int correctCount,
            int xpAwarded,
            XpReason xpReason,
            List<RunCardDto> cards,
            ProgressDelta delta) {
    }
}
