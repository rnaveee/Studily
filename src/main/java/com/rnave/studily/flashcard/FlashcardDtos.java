package com.rnave.studily.flashcard;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public class FlashcardDtos {

    public record FlashcardDto(
            Long id,
            @NotBlank String front,
            @NotBlank String back) {

        public static FlashcardDto from(Flashcard c) {
            return new FlashcardDto(c.getId(), c.getFront(), c.getBack());
        }
    }

    public record FlashcardSetDto(
            Long id,
            Long courseId,
            String title,
            Instant createdAt,
            List<FlashcardDto> cards) {

        public static FlashcardSetDto from(FlashcardSet s) {
            return new FlashcardSetDto(
                    s.getId(),
                    s.getCourse() != null ? s.getCourse().getId() : null,
                    s.getTitle(),
                    s.getCreatedAt(),
                    s.getCards().stream().map(FlashcardDto::from).toList());
        }
    }

    public record FlashcardSetRequest(
            @NotBlank String title,
            Long courseId,
            @Valid List<FlashcardDto> cards) {
    }
}
