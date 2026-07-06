package com.rnave.studily.flashcard;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class FlashcardDtos {

    public record FlashcardDto(
            Long id,
            @NotBlank @Size(max = 10000) String front,
            @NotBlank @Size(max = 10000) String back) {

        public static FlashcardDto from(Flashcard c) {
            return new FlashcardDto(c.getId(), c.getFront(), c.getBack());
        }
    }

    public record FlashcardSetDto(
            Long id,
            Long courseId,
            String title,
            String description,
            Instant createdAt,
            List<FlashcardDto> cards) {

        public static FlashcardSetDto from(FlashcardSet s) {
            return new FlashcardSetDto(
                    s.getId(),
                    s.getCourse() != null ? s.getCourse().getId() : null,
                    s.getTitle(),
                    s.getDescription(),
                    s.getCreatedAt(),
                    s.getCards().stream().map(FlashcardDto::from).toList());
        }
    }

    public record FlashcardSetRequest(
            @NotBlank @Size(max = 255) String title,
            @Size(max = 2000) String description,
            Long courseId,
            @Valid @Size(max = 500) List<FlashcardDto> cards) {
    }
}
