package com.rnave.studily.feynman;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class FeynmanDtos {

    public record AvailabilityDto(boolean enabled, boolean paused, int remainingToday,
                                  int maxFiles, long maxFileBytes) {
    }

    public record SessionSummaryDto(Long id, String title, FeynmanStatus status, Integer score, Instant updatedAt) {
    }

    public record DocumentDto(Long id, String fileName, long sizeBytes, int chars, Instant createdAt) {
    }

    public record MessageDto(Long id, FeynmanRole role, FeynmanKind kind, String body, Instant createdAt) {
    }

    public record SessionDto(Long id, String title, String focus, FeynmanStatus status, Integer score,
                             List<DocumentDto> documents, List<MessageDto> messages) {
    }

    public record SendMessageRequest(@NotBlank @Size(max = 4000) String body) {
    }

    public record TurnDto(List<MessageDto> messages, FeynmanStatus status, Integer score) {
    }

    public record ConceptScoreDto(String concept, int score, boolean didNotKnow) {
    }

    public record GapDto(String concept, String detail) {
    }

    public record ReportDto(int score, String summary, List<String> strengths, List<GapDto> gaps,
                            List<ConceptScoreDto> concepts) {
    }
}
