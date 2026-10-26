package com.rnave.studily.exam;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public class ExamDtos {

    public record UpcomingExamDto(
            Long id,
            String title,
            Instant dueAt,
            Long courseId,
            String courseName,
            String courseCode,
            String courseColor,
            long daysLeft,
            Double weight,
            Double currentPercent,
            Double targetGrade,
            Double neededPercent,
            int linkedSets,
            int linkedTodos) {
    }

    public record LinkRequest(Long flashcardSetId, Long todoId) {
    }

    public record PlanSetDto(Long linkId, Long setId, String title, int totalCards, int remainingCards) {
    }

    public record PlanTodoDto(Long linkId, Long todoId, String title, boolean completed) {
    }

    public record PlanTaskDto(Long todoId, String title) {
    }

    public record PlanDayDto(LocalDate date, int cards, List<PlanTaskDto> todos, boolean today) {
    }

    public record PlanDto(
            Long examId,
            String title,
            Instant dueAt,
            Long courseId,
            String courseName,
            long daysLeft,
            int remainingCards,
            int todayCards,
            List<PlanSetDto> sets,
            List<PlanTodoDto> todos,
            List<PlanDayDto> days) {
    }
}
