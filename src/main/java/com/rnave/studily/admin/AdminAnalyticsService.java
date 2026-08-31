package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.ActivityMetrics;
import com.rnave.studily.admin.AdminDtos.ContentMetric;
import com.rnave.studily.admin.AdminDtos.Funnel;
import com.rnave.studily.admin.AdminDtos.GrowthPoint;
import com.rnave.studily.admin.AdminDtos.Overview;
import com.rnave.studily.admin.AdminDtos.RecentUser;
import com.rnave.studily.admin.AdminDtos.SchoolCount;
import com.rnave.studily.admin.AdminDtos.UserMetrics;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class AdminAnalyticsService {

    private record ContentSource(String label, String table, String createdColumn) {
    }

    private static final List<ContentSource> CONTENT = List.of(
            new ContentSource("Semesters", "semesters", null),
            new ContentSource("Courses", "courses", null),
            new ContentSource("Assignments & exams", "academic_items", null),
            new ContentSource("Calendar events", "calendar_events", null),
            new ContentSource("To-dos", "todos", "created_at"),
            new ContentSource("Flashcard sets", "flashcard_sets", "created_at"),
            new ContentSource("Flashcards", "flashcards", null),
            new ContentSource("Notes", "notes", null),
            new ContentSource("Messages", "messages", "created_at"),
            new ContentSource("Conversations", "conversations", "created_at"),
            new ContentSource("Notifications sent", "notifications", "created_at"),
            new ContentSource("Push subscriptions", "push_subscriptions", "created_at"));

    private final JdbcTemplate jdbc;

    public AdminAnalyticsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Overview overview() {
        return new Overview(
                userMetrics(),
                activityMetrics(),
                funnel(),
                contentMetrics(),
                topSchools(),
                recentSignups());
    }

    private UserMetrics userMetrics() {
        return jdbc.queryForObject("""
                SELECT
                    count(*)                                                                   AS total,
                    count(*) FILTER (WHERE email_verified)                                     AS verified,
                    count(*) FILTER (WHERE created_at >= date_trunc('day', now()))             AS new_today,
                    count(*) FILTER (WHERE created_at >= now() - interval '7 days')            AS new_7d,
                    count(*) FILTER (WHERE created_at >= now() - interval '14 days'
                                       AND created_at <  now() - interval '7 days')            AS prev_7d,
                    count(*) FILTER (WHERE created_at >= now() - interval '30 days')           AS new_30d,
                    count(*) FILTER (WHERE last_active_at IS NULL)                             AS never_active
                FROM users
                """, (rs, i) -> new UserMetrics(
                rs.getLong("total"),
                rs.getLong("verified"),
                rs.getLong("new_today"),
                rs.getLong("new_7d"),
                rs.getLong("prev_7d"),
                rs.getLong("new_30d"),
                rs.getLong("never_active")));
    }

    private ActivityMetrics activityMetrics() {
        return jdbc.queryForObject("""
                SELECT
                    count(*) FILTER (WHERE last_active_at >= now() - interval '1 day')   AS dau,
                    count(*) FILTER (WHERE last_active_at >= now() - interval '7 days')  AS wau,
                    count(*) FILTER (WHERE last_active_at >= now() - interval '30 days') AS mau,
                    count(*) FILTER (WHERE last_active_at >= now() - interval '14 days'
                                       AND last_active_at <  now() - interval '7 days')  AS wau_prev,
                    count(*) FILTER (WHERE last_active_at IS NULL)                       AS never_active
                FROM users
                """, (rs, i) -> {
            long dau = rs.getLong("dau");
            long mau = rs.getLong("mau");
            return new ActivityMetrics(
                    dau,
                    rs.getLong("wau"),
                    mau,
                    rs.getLong("wau_prev"),
                    mau == 0 ? 0 : (double) dau / mau,
                    rs.getLong("never_active"));
        });
    }

    private List<Funnel> funnel() {
        return jdbc.queryForObject("""
                SELECT
                    (SELECT count(*) FROM users)                                              AS signed_up,
                    (SELECT count(*) FROM users WHERE email_verified)                          AS verified,
                    (SELECT count(DISTINCT user_id) FROM courses)                              AS with_course,
                    (SELECT count(DISTINCT c.user_id) FROM courses c
                        JOIN academic_items i ON i.course_id = c.id)                           AS with_item,
                    (SELECT count(*) FROM users
                        WHERE last_active_at >= now() - interval '7 days')                     AS active_7d
                """, (rs, i) -> {
            long signedUp = rs.getLong("signed_up");
            List<Funnel> steps = new ArrayList<>();
            steps.add(step("Signed up", signedUp, signedUp));
            steps.add(step("Verified email", rs.getLong("verified"), signedUp));
            steps.add(step("Added a course", rs.getLong("with_course"), signedUp));
            steps.add(step("Added coursework", rs.getLong("with_item"), signedUp));
            steps.add(step("Active this week", rs.getLong("active_7d"), signedUp));
            return steps;
        });
    }

    private static Funnel step(String label, long count, long base) {
        return new Funnel(label, count, base == 0 ? 0 : (double) count / base);
    }

    private List<ContentMetric> contentMetrics() {
        List<ContentMetric> metrics = new ArrayList<>();
        for (ContentSource source : CONTENT) {
            String sql = source.createdColumn() == null
                    ? "SELECT count(*) AS total, 0 AS recent FROM " + source.table()
                    : "SELECT count(*) AS total, count(*) FILTER (WHERE %s >= now() - interval '7 days') AS recent FROM %s"
                            .formatted(source.createdColumn(), source.table());
            metrics.add(jdbc.queryForObject(sql, (rs, i) ->
                    new ContentMetric(source.label(), rs.getLong("total"), rs.getLong("recent"))));
        }
        metrics.add(jdbc.queryForObject("""
                SELECT count(*) AS total, 0 AS recent FROM friend_requests WHERE status = 'ACCEPTED'
                """, (rs, i) -> new ContentMetric("Friendships", rs.getLong("total"), 0)));
        metrics.add(jdbc.queryForObject("""
                SELECT count(*) AS total, 0 AS recent FROM courses WHERE canvas_course_id IS NOT NULL
                """, (rs, i) -> new ContentMetric("Canvas-linked courses", rs.getLong("total"), 0)));
        return metrics;
    }

    private List<SchoolCount> topSchools() {
        return jdbc.query("""
                SELECT coalesce(nullif(trim(school), ''), 'Not set') AS school, count(*) AS users
                FROM users
                GROUP BY 1
                ORDER BY users DESC, school ASC
                LIMIT 12
                """, (rs, i) -> new SchoolCount(rs.getString("school"), rs.getLong("users")));
    }

    private List<RecentUser> recentSignups() {
        return jdbc.query("""
                SELECT id, username, name, email, school, email_verified, created_at, last_active_at
                FROM users
                ORDER BY created_at DESC
                LIMIT 10
                """, (rs, i) -> new RecentUser(
                rs.getLong("id"),
                rs.getString("username"),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("school"),
                rs.getBoolean("email_verified"),
                instant(rs.getTimestamp("created_at")),
                instant(rs.getTimestamp("last_active_at"))));
    }

    public List<GrowthPoint> growth(int days) {
        int window = Math.min(Math.max(days, 7), 180);
        return jdbc.query("""
                WITH days AS (
                    SELECT generate_series(
                        date_trunc('day', now()) - make_interval(days => ? - 1),
                        date_trunc('day', now()),
                        interval '1 day') AS day
                )
                SELECT d.day::date AS day,
                    (SELECT count(*) FROM users u
                        WHERE u.created_at >= d.day AND u.created_at < d.day + interval '1 day') AS signups,
                    (SELECT count(*) FROM messages m
                        WHERE m.created_at >= d.day AND m.created_at < d.day + interval '1 day') AS messages,
                    (SELECT count(*) FROM todos t
                        WHERE t.created_at >= d.day AND t.created_at < d.day + interval '1 day') AS items
                FROM days d
                ORDER BY d.day
                """, (rs, i) -> new GrowthPoint(
                rs.getDate("day").toLocalDate(),
                rs.getLong("signups"),
                rs.getLong("messages"),
                rs.getLong("items")), window);
    }

    static Instant instant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
