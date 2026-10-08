package com.rnave.studily.studysession;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public class StudySessionDtos {

    public record StartSessionRequest(
            @NotNull StudySessionMode mode,
            Integer blocks,
            Integer minutes,
            @Size(max = 50) List<String> tasks) {
    }

    public record TaskDoneRequest(@NotNull Boolean done) {
    }

    public record StudySessionTaskDto(Long id, int position, String text, boolean done) {

        public static StudySessionTaskDto from(StudySessionTask t) {
            return new StudySessionTaskDto(t.getId(), t.getPosition(), t.getText(), t.getDoneAt() != null);
        }
    }

    public record StudySessionBlockDto(
            int index,
            StudyBlockStatus status,
            Instant startedAt,
            Instant dueAt,
            int creditedMinutes,
            int xpAwarded) {

        public static StudySessionBlockDto from(StudySessionBlock b) {
            return new StudySessionBlockDto(b.getBlockIndex(), b.getStatus(), b.getStartedAt(), b.getDueAt(),
                    b.getCreditedMinutes(), b.getXpAwarded());
        }
    }

    public record StudySessionDto(
            Long id,
            StudySessionMode mode,
            StudySessionStatus status,
            int plannedBlocks,
            int blockMinutes,
            int breakMinutes,
            int plannedMinutes,
            Instant startedAt,
            Instant endedAt,
            int currentBlock,
            Instant checkinOpensAt,
            Instant checkinClosesAt,
            int creditedMinutes,
            int xpAwarded,
            double multiplier,
            List<StudySessionTaskDto> tasks,
            List<StudySessionBlockDto> blocks,
            Instant serverNow) {
    }

    public record StudySessionSummaryDto(
            Long id,
            StudySessionMode mode,
            StudySessionStatus status,
            Instant startedAt,
            Instant endedAt,
            int plannedMinutes,
            int creditedMinutes,
            int xpAwarded,
            int tasksDone,
            int tasksTotal) {
    }

    public record StudySessionResult(StudySessionDto session, ProgressDelta delta) {
    }

    public record StreakDayDto(
            LocalDate date,
            String label,
            boolean qualified,
            @JsonProperty("isToday") boolean isToday) {
    }

    public record StreakWeekDto(
            int current,
            int best,
            double multiplier,
            int minutesToday,
            LocalDate today,
            List<StreakDayDto> week) {
    }
}
