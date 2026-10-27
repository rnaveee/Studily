package com.rnave.studily.admin;

import com.rnave.studily.moderation.ModerationActionType;
import com.rnave.studily.moderation.ReportReason;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record AdminStatus(
            boolean unlocked,
            boolean totpEnabled,
            Instant expiresAt,
            long sessionMs,
            String username) {
    }

    public record UnlockRequest(String password, String code) {
    }

    public record UnlockResponse(String token, Instant expiresAt) {
    }

    public record TotpSetup(String secret, String provisioningUri) {
    }

    public record Overview(
            UserMetrics users,
            ActivityMetrics activity,
            List<Funnel> funnel,
            List<ContentMetric> content,
            List<SchoolCount> schools,
            List<RecentUser> recentSignups) {
    }

    public record UserMetrics(
            long total,
            long verified,
            long newToday,
            long new7d,
            long prev7d,
            long new30d,
            long deletedNever) {
    }

    public record ActivityMetrics(
            long dau,
            long wau,
            long mau,
            long wauPrev,
            double stickiness,
            long neverActive) {
    }

    public record Funnel(String label, long count, double rate) {
    }

    public record ContentMetric(String label, long total, long last7d) {
    }

    public record SchoolCount(String school, long users) {
    }

    public record RecentUser(
            Long id,
            String username,
            String name,
            String email,
            String school,
            boolean emailVerified,
            Instant createdAt,
            Instant lastActiveAt) {
    }

    public record ParseSpend(
            long parsesToday,
            long parses7d,
            long parsesTotal,
            double usdToday,
            double usd7d,
            double usdTotal,
            List<ParseSpender> topSpenders7d,
            List<FeatureBudget> budgets) {
    }

    public record FeatureBudget(String feature, String label, long usesThisMonth, double usdToday,
                                double dailyBudget, double usdMonth, double monthlyBudget) {
    }

    public record ParseSpender(String username, long parses, double usd) {
    }

    public record GrowthPoint(LocalDate date, long signups, long messages, long items) {
    }

    public record UserRow(
            Long id,
            String username,
            String name,
            String email,
            String school,
            boolean emailVerified,
            Instant createdAt,
            Instant lastActiveAt,
            long courses,
            long items,
            String status,
            boolean banned,
            Instant suspendedUntil,
            long openReports) {
    }

    public record UserDetail(
            UserRow user,
            Integer year,
            String major,
            String bio,
            int tokenVersion,
            Map<String, Long> counts,
            String avatarUrl,
            List<ModerationActionRow> actions) {
    }

    public record ReportGroupRow(
            Long userId,
            String username,
            String name,
            String avatarUrl,
            String status,
            boolean banned,
            Instant suspendedUntil,
            long openCount,
            long totalCount,
            Map<String, Long> openReasons,
            Instant latestAt) {
    }

    public record ReportRow(
            Long id,
            String kind,
            String reason,
            String details,
            String status,
            Long reporterId,
            String reporterUsername,
            Instant createdAt,
            Long messageId,
            Long conversationId,
            String messageBody,
            String attachmentFilename,
            String attachmentContentType,
            Instant messageCreatedAt,
            boolean messageExists,
            boolean hasEvidence,
            String targetNameSnapshot,
            String targetBioSnapshot,
            Instant resolvedAt,
            String resolvedBy,
            Long actionId) {
    }

    public record ModerationActionRow(
            Long id,
            String type,
            List<String> reasons,
            String note,
            Instant createdAt,
            String createdBy,
            Instant endsAt,
            Instant acknowledgedAt,
            Instant revokedAt,
            String revokedBy,
            boolean removedAvatar,
            boolean clearedBio,
            int deletedMessages,
            boolean active) {
    }

    public record ReportCase(
            UserRow user,
            String bio,
            String avatarUrl,
            List<ReportRow> reports,
            List<ModerationActionRow> actions) {
    }

    public record ModerationRequest(
            @NotNull ModerationActionType type,
            Integer days,
            @NotEmpty @Size(max = 8) List<@NotNull ReportReason> reasons,
            @Size(max = 500) String note,
            boolean removeAvatar,
            boolean clearBio,
            @Size(max = 50) List<Long> deleteMessageIds,
            @Size(max = 200) List<Long> reportIds) {
    }

    public record ModerationResult(
            Long actionId,
            String status,
            boolean banned,
            Instant suspendedUntil,
            int deletedMessages) {
    }

    public record DismissRequest(@Size(max = 200) List<Long> reportIds) {
    }

    public record EvidenceContent(String contentType, byte[] data) {
    }

    public record ResetLink(String url, Instant expiresAt) {
    }

    public record TableInfo(String name, long rows, long sizeBytes, String sizePretty) {
    }

    public record ColumnInfo(String name, String type, boolean nullable, boolean primaryKey, boolean binary) {
    }

    public record TableRows(
            String table,
            String primaryKey,
            List<ColumnInfo> columns,
            List<Map<String, Object>> rows,
            long total,
            int page,
            int size) {
    }

    public record QueryRequest(String sql, boolean write) {
    }

    public record QueryResult(
            List<String> columns,
            List<List<Object>> rows,
            Integer rowsAffected,
            long millis,
            boolean truncated,
            String statementType) {
    }

    public record Health(
            String status,
            long dbLatencyMs,
            String dbVersion,
            String dbSize,
            long schemaVersion,
            long uptimeMs,
            long heapUsedMb,
            long heapMaxMb,
            int availableProcessors,
            boolean mailConfigured,
            boolean pushConfigured,
            boolean sentryConfigured,
            boolean totpEnabled,
            String timezone) {
    }

    public record BroadcastRequest(String title, String body, String url, boolean onlyActive, String username,
                                   Boolean push) {
    }

    public record BroadcastResult(int recipients) {
    }

    public record AuditRow(
            Long id,
            String actorName,
            String action,
            String target,
            String detail,
            String ip,
            Instant createdAt) {
    }

    public record Paged<T>(List<T> items, boolean hasMore, long total) {
    }

    public record SurveyCount(String label, long count) {
    }

    public record SurveyMatrixRow(String id, String label, List<SurveyCount> counts) {
    }

    public record SurveyQuestionSummary(
            String id,
            int step,
            String type,
            String prompt,
            long respondents,
            List<SurveyCount> counts,
            List<SurveyMatrixRow> matrix) {
    }

    public record SurveySummary(
            String key,
            long responses,
            long eligible,
            Double pmfAll,
            long pmfAllBase,
            Double pmfWeekly,
            long pmfWeeklyBase,
            Double nps,
            long npsBase,
            Double avgEase,
            List<SurveyQuestionSummary> questions) {
    }

    public record SurveyTextAnswer(String username, Instant createdAt, String value) {
    }

    public record SurveyContact(String username, String email, Instant createdAt) {
    }
}
