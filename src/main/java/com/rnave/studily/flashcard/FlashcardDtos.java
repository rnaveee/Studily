package com.rnave.studily.flashcard;

import com.rnave.studily.user.AvatarUrls;
import com.rnave.studily.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class FlashcardDtos {

    public record FlashcardDto(
            Long id,
            @NotBlank @Size(max = 10000) String front,
            @NotBlank @Size(max = 10000) String back,
            Instant dueAt,
            Integer intervalDays,
            Integer repetitions,
            Double easeFactor) {

        public static FlashcardDto from(Flashcard c) {
            return new FlashcardDto(c.getId(), c.getFront(), c.getBack(),
                    c.getDueAt(), c.getIntervalDays(), c.getRepetitions(), c.getEaseFactor());
        }
    }

    public record FlashcardSetDto(
            Long id,
            Long courseId,
            String title,
            String description,
            FlashcardSetVisibility visibility,
            Instant createdAt,
            long dueCount,
            List<FlashcardDto> cards) {

        public static FlashcardSetDto from(FlashcardSet s) {
            Instant now = Instant.now();
            return new FlashcardSetDto(
                    s.getId(),
                    s.getCourse() != null ? s.getCourse().getId() : null,
                    s.getTitle(),
                    s.getDescription(),
                    s.getVisibility(),
                    s.getCreatedAt(),
                    s.getCards().stream().filter(c -> !c.getDueAt().isAfter(now)).count(),
                    s.getCards().stream().map(FlashcardDto::from).toList());
        }
    }

    public record FlashcardSetRequest(
            @NotBlank @Size(max = 255) String title,
            @Size(max = 2000) String description,
            Long courseId,
            @Valid @Size(max = 500) List<FlashcardDto> cards,
            FlashcardSetVisibility visibility) {
    }

    public record ReviewRequest(@NotNull Sm2.Grade grade) {
    }

    public record VisibilityRequest(@NotNull FlashcardSetVisibility visibility) {
    }

    public record SetOwnerDto(Long id, String username, String name, String avatarUrl) {

        public static SetOwnerDto from(User u) {
            return new SetOwnerDto(u.getId(), u.getUsername(), u.getName(), AvatarUrls.of(u));
        }
    }

    public record SharedCardDto(Long id, String front, String back) {

        public static SharedCardDto from(Flashcard c) {
            return new SharedCardDto(c.getId(), c.getFront(), c.getBack());
        }
    }

    public record SharedFlashcardSetDto(
            Long id,
            String title,
            String description,
            Instant createdAt,
            int cardCount,
            SetOwnerDto owner,
            boolean viewerIsOwner,
            List<SharedCardDto> cards) {

        public static SharedFlashcardSetDto from(FlashcardSet s, boolean viewerIsOwner) {
            return new SharedFlashcardSetDto(
                    s.getId(),
                    s.getTitle(),
                    s.getDescription(),
                    s.getCreatedAt(),
                    s.getCards().size(),
                    SetOwnerDto.from(s.getUser()),
                    viewerIsOwner,
                    s.getCards().stream().map(SharedCardDto::from).toList());
        }
    }

    public record FlashcardSetSummaryDto(Long id, String title, String description, int cardCount, Instant createdAt) {

        public static FlashcardSetSummaryDto from(FlashcardSet s) {
            return new FlashcardSetSummaryDto(s.getId(), s.getTitle(), s.getDescription(),
                    s.getCards().size(), s.getCreatedAt());
        }
    }
}
