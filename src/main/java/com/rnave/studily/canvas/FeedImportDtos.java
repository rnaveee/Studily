package com.rnave.studily.canvas;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.course.CourseDtos.CourseRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class FeedImportDtos {

    public enum StagedKind { ITEM, EVENT }

    public enum CourseChoice { ADD, MERGE, SKIP }

    public enum ItemChoice { ADD, REPLACE, SKIP }

    public record StagedItem(
            String key,
            String externalUid,
            StagedKind kind,
            ItemType type,
            String title,
            Instant dueAt,
            String place) {
    }

    public record StagedCourse(
            String key,
            Long canvasCourseId,
            String lmsProvider,
            String lmsCourseId,
            String name,
            String code,
            String color,
            Long semesterId,
            Long linkedCourseId,
            Long matchCourseId,
            List<StagedItem> items) {
    }

    public record StagedPayload(String provider, Long semesterId, List<StagedCourse> courses) {
    }

    public record StageOutcome(StagedPayload payload, int itemsUpdated, int eventsImported, int skipped,
                               boolean truncated) {
    }

    public record StoredImport(FeedStageResult result, StagedPayload payload) {
    }

    public record FeedStageResult(
            Long importId,
            String provider,
            int newCourses,
            int newItems,
            int itemsUpdated,
            int eventsImported,
            boolean truncated) {
    }

    public record StagedCourseView(
            String key,
            Long canvasCourseId,
            String lmsProvider,
            String lmsCourseId,
            String name,
            String code,
            String color,
            Long semesterId,
            Long linkedCourseId,
            Long matchCourseId,
            List<StagedItem> items,
            CourseDto match,
            CourseDto linked) {
    }

    public record FeedImportView(
            Long id,
            String provider,
            FeedImport.Status status,
            Instant createdAt,
            List<StagedCourseView> courses) {
    }

    public record CourseDecision(
            @NotBlank @Size(max = 255) String key,
            @NotNull CourseChoice decision,
            @Valid CourseRequest overrides,
            Long targetCourseId) {
    }

    public record ItemDecision(
            @NotBlank @Size(max = 255) String key,
            @NotNull ItemChoice decision,
            Long existingId,
            StagedKind existingKind) {
    }

    public record CourseDecisions(@Valid @NotNull @Size(max = 500) List<CourseDecision> courses) {
    }

    public record ExistingItem(
            Long id,
            StagedKind kind,
            String title,
            ItemType type,
            Instant dueAt,
            Long courseId,
            String courseName,
            String courseCode) {
    }

    public record Conflict(String itemKey, String courseKey, StagedItem incoming, ExistingItem existing) {
    }

    public record ApplyRequest(
            @Valid @NotNull @Size(max = 500) List<CourseDecision> courses,
            @Valid @Size(max = 5000) List<ItemDecision> items) {
    }

    public record ApplyResult(
            int coursesCreated,
            int coursesMerged,
            int itemsAdded,
            int itemsReplaced,
            int itemsSkipped) {
    }
}
