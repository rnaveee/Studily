package com.rnave.studily.parse;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.course.CourseDtos.MeetingBlockDto;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class CourseParseDtos {

    public record DraftItemDto(
            ItemType type,
            String title,
            String dueAt,
            Double weight,
            String location,
            String category) {
    }

    public record DraftCategoryDto(
            String name,
            ItemType kind,
            Double weight) {
    }

    public record CourseDraftDto(
            Long parseId,
            String name,
            String code,
            String professor,
            String location,
            List<MeetingBlockDto> meetingBlocks,
            List<DraftCategoryDto> gradeCategories,
            List<DraftItemDto> items,
            List<String> warnings) {
    }

    public record ParseAvailabilityDto(boolean enabled) {
    }

    public record ParseAccuracyDto(Long successRate, long sampleSize) {
    }

    public record ParseFeedbackRequest(@NotNull Long parseId, @NotNull ParseRating rating) {
    }
}
