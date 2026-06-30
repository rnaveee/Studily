package com.rnave.studily.academic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

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
            ItemStatus status) {

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
                    i.getStatus());
        }
    }

    public record AcademicItemRequest(
            @NotNull ItemType type,
            @NotBlank String title,
            @NotNull Instant dueAt,
            String location,
            Double weight,
            ItemStatus status) {
    }
}
