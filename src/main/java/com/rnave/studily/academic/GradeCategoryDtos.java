package com.rnave.studily.academic;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public class GradeCategoryDtos {

    public record GradeCategoryDto(
            Long id,
            Long courseId,
            String name,
            ItemType kind,
            Double weight,
            String color,
            int position) {

        public static GradeCategoryDto from(GradeCategory c) {
            return new GradeCategoryDto(
                    c.getId(),
                    c.getCourse().getId(),
                    c.getName(),
                    c.getKind(),
                    c.getWeight(),
                    c.getColor(),
                    c.getPosition());
        }
    }

    public record GradeCategoryRequest(
            @NotBlank @Size(max = 60) String name,
            @PositiveOrZero @Max(100) Double weight,
            Integer position,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "must be a hex color like #3b82f6")
            String color) {
    }
}
