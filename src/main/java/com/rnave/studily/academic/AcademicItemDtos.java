package com.rnave.studily.academic;

import com.rnave.studily.recurrence.RecurrenceDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class AcademicItemDtos {

    public record AcademicItemDto(
            Long id,
            Long courseId,
            String courseName,
            String courseColor,
            ItemType type,
            String title,
            Instant dueAt,
            String location,
            Double weight,
            Double score,
            Double maxScore,
            ItemStatus status,
            UUID seriesId,
            String recurrenceRule,
            boolean canvasSynced) {

        public static AcademicItemDto from(AcademicItem i) {
            return new AcademicItemDto(
                    i.getId(),
                    i.getCourse().getId(),
                    i.getCourse().getName(),
                    i.getCourse().getColor(),
                    i.getType(),
                    i.getTitle(),
                    i.getDueAt(),
                    i.getLocation(),
                    i.getWeight(),
                    i.getScore(),
                    i.getMaxScore(),
                    i.getStatus(),
                    i.getSeriesId(),
                    i.getRecurrenceRule(),
                    i.getExternalUid() != null);
        }
    }

    public record AcademicItemRequest(
            @NotNull ItemType type,
            @NotBlank @Size(max = 255) String title,
            @NotNull Instant dueAt,
            @Size(max = 255) String location,
            @PositiveOrZero @Max(1000) Double weight,
            @PositiveOrZero @Max(1_000_000) Double score,
            @Positive @Max(1_000_000) Double maxScore,
            ItemStatus status,
            @Valid RecurrenceDto recurrence) {
    }
}
