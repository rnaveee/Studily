package com.rnave.studily.admin;

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
            long items) {
    }

    public record UserDetail(
            UserRow user,
            Integer year,
            String major,
            String bio,
            int tokenVersion,
            Map<String, Long> counts) {
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

    public record BroadcastRequest(String title, String body, String url, boolean onlyActive) {
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
}
