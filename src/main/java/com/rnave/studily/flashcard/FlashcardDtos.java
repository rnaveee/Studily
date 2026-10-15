package com.rnave.studily.flashcard;

import com.rnave.studily.user.AvatarUrls;
import com.rnave.studily.user.FlairRef;
import com.rnave.studily.user.Flairs;
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
            @Size(max = 10000) String front,
            @Size(max = 10000) String back,
            @Size(max = 32) String frontImage,
            @Size(max = 32) String backImage,
            Instant dueAt,
            Integer intervalDays,
            Integer repetitions,
            Double easeFactor) {

        public static FlashcardDto from(Flashcard c) {
            return new FlashcardDto(c.getId(), c.getFront(), c.getBack(), c.getFrontImageKey(), c.getBackImageKey(),
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
            CopiedFromDto copiedFrom,
            List<FlashcardDto> cards) {

        public static FlashcardSetDto from(FlashcardSet s) {
            return from(s, null);
        }

        public static FlashcardSetDto from(FlashcardSet s, CopiedFromDto copiedFrom) {
            Instant now = Instant.now();
            return new FlashcardSetDto(
                    s.getId(),
                    s.getCourse() != null ? s.getCourse().getId() : null,
                    s.getTitle(),
                    s.getDescription(),
                    s.getVisibility(),
                    s.getCreatedAt(),
                    s.getCards().stream().filter(c -> !c.needsImage() && !c.getDueAt().isAfter(now)).count(),
                    copiedFrom,
                    s.getCards().stream().map(FlashcardDto::from).toList());
        }
    }

    public record CopiedFromDto(Long setId, String title, SetOwnerDto owner) {
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

    public record SetOwnerDto(Long id, String username, String name, String avatarUrl, FlairRef flair) {

        public static SetOwnerDto from(User u, Flairs flairs) {
            return new SetOwnerDto(u.getId(), u.getUsername(), u.getName(), AvatarUrls.of(u), flairs.refOf(u));
        }
    }

    public record SharedCardDto(Long id, String front, String back, String frontImage, String backImage) {

        public static SharedCardDto from(Flashcard c) {
            return new SharedCardDto(c.getId(), c.getFront(), c.getBack(), c.getFrontImageKey(), c.getBackImageKey());
        }
    }

    public record SharedFlashcardSetDto(
            Long id,
            String title,
            String description,
            FlashcardSetVisibility visibility,
            Instant createdAt,
            int cardCount,
            SetOwnerDto owner,
            boolean viewerIsOwner,
            List<SharedCardDto> cards) {

        public static SharedFlashcardSetDto from(FlashcardSet s, boolean viewerIsOwner, Flairs flairs) {
            List<SharedCardDto> cards = s.completeCards().stream().map(SharedCardDto::from).toList();
            return new SharedFlashcardSetDto(
                    s.getId(),
                    s.getTitle(),
                    s.getDescription(),
                    s.getVisibility(),
                    s.getCreatedAt(),
                    cards.size(),
                    SetOwnerDto.from(s.getUser(), flairs),
                    viewerIsOwner,
                    cards);
        }
    }

    public record FlashcardSetSummaryDto(Long id, String title, String description,
                                         FlashcardSetVisibility visibility, int cardCount, Instant createdAt) {

        public static FlashcardSetSummaryDto from(FlashcardSet s) {
            return new FlashcardSetSummaryDto(s.getId(), s.getTitle(), s.getDescription(),
                    s.getVisibility(), s.completeCards().size(), s.getCreatedAt());
        }
    }

    public record SetPagePreview(Long id, String title, String description, String ownerName, String ownerUsername,
                                 int cardCount, String courseCode, String courseName, String courseColor) {

        public String ownerLabel() {
            return ownerName != null && !ownerName.isBlank() ? ownerName.trim() : "@" + ownerUsername;
        }
    }
}
