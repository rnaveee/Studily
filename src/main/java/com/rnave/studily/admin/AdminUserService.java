package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.Paged;
import com.rnave.studily.admin.AdminDtos.ResetLink;
import com.rnave.studily.admin.AdminDtos.UserDetail;
import com.rnave.studily.admin.AdminDtos.UserRow;
import com.rnave.studily.auth.AccountTokenService;
import com.rnave.studily.auth.AccountTokenType;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminUserService {

    private static final Map<String, String> COUNT_QUERIES = new LinkedHashMap<>() {{
        put("semesters", "SELECT count(*) FROM semesters WHERE user_id = ?");
        put("courses", "SELECT count(*) FROM courses WHERE user_id = ?");
        put("coursework", "SELECT count(*) FROM academic_items i JOIN courses c ON c.id = i.course_id WHERE c.user_id = ?");
        put("calendarEvents", "SELECT count(*) FROM calendar_events WHERE user_id = ?");
        put("todos", "SELECT count(*) FROM todos WHERE user_id = ?");
        put("flashcardSets", "SELECT count(*) FROM flashcard_sets WHERE user_id = ?");
        put("messagesSent", "SELECT count(*) FROM messages WHERE sender_id = ?");
        put("conversations", "SELECT count(*) FROM conversation_members WHERE user_id = ?");
        put("friends", "SELECT count(*) FROM friend_requests WHERE status = 'ACCEPTED' AND (requester_id = ? OR addressee_id = ?)");
        put("pushDevices", "SELECT count(*) FROM push_subscriptions WHERE user_id = ?");
        put("notifications", "SELECT count(*) FROM notifications WHERE user_id = ?");
    }};

    private static final String ROW_COLUMNS = """
            u.id, u.username, u.name, u.email, u.school, u.email_verified, u.created_at, u.last_active_at,
            (SELECT count(*) FROM courses c WHERE c.user_id = u.id) AS courses,
            (SELECT count(*) FROM academic_items i
                JOIN courses c ON c.id = i.course_id WHERE c.user_id = u.id) AS items
            """;

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final AccountTokenService accountTokenService;
    private final AdminGuard adminGuard;
    private final String baseUrl;

    public AdminUserService(JdbcTemplate jdbc, UserRepository userRepository,
                            AccountTokenService accountTokenService, AdminGuard adminGuard,
                            @Value("${app.base-url}") String baseUrl) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.accountTokenService = accountTokenService;
        this.adminGuard = adminGuard;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public Paged<UserRow> search(String query, String sort, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        String order = switch (sort == null ? "" : sort) {
            case "active" -> "u.last_active_at DESC NULLS LAST";
            case "username" -> "lower(u.username) ASC";
            case "courses" -> "courses DESC";
            default -> "u.created_at DESC";
        };

        boolean filtered = query != null && !query.isBlank();
        String where = filtered
                ? " WHERE u.username ILIKE ? OR u.email ILIKE ? OR u.name ILIKE ? OR u.school ILIKE ? OR CAST(u.id AS TEXT) = ?"
                : "";
        Object[] args;
        if (filtered) {
            String pattern = "%" + query.trim() + "%";
            args = new Object[]{pattern, pattern, pattern, pattern, query.trim()};
        } else {
            args = new Object[0];
        }

        Long total = jdbc.queryForObject("SELECT count(*) FROM users u" + where, Long.class, args);

        Object[] pagedArgs = new Object[args.length + 2];
        System.arraycopy(args, 0, pagedArgs, 0, args.length);
        pagedArgs[args.length] = safeSize;
        pagedArgs[args.length + 1] = safePage * safeSize;

        List<UserRow> rows = jdbc.query(
                "SELECT " + ROW_COLUMNS + " FROM users u" + where
                        + " ORDER BY " + order + " LIMIT ? OFFSET ?",
                (rs, i) -> mapRow(rs), pagedArgs);

        long count = total == null ? 0 : total;
        return new Paged<>(rows, (long) (safePage + 1) * safeSize < count, count);
    }

    private static UserRow mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new UserRow(
                rs.getLong("id"),
                rs.getString("username"),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("school"),
                rs.getBoolean("email_verified"),
                AdminAnalyticsService.instant(rs.getTimestamp("created_at")),
                AdminAnalyticsService.instant(rs.getTimestamp("last_active_at")),
                rs.getLong("courses"),
                rs.getLong("items"));
    }

    public UserDetail detail(Long id) {
        User user = require(id);
        UserRow row = jdbc.query(
                "SELECT " + ROW_COLUMNS + " FROM users u WHERE u.id = ?",
                (rs, i) -> mapRow(rs), id).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("User not found"));

        Map<String, Long> counts = new LinkedHashMap<>();
        COUNT_QUERIES.forEach((key, sql) -> {
            int params = (int) sql.chars().filter(c -> c == '?').count();
            Object[] args = new Object[params];
            java.util.Arrays.fill(args, id);
            counts.put(key, jdbc.queryForObject(sql, Long.class, args));
        });

        return new UserDetail(
                row, user.getYear(), user.getMajor(), user.getBio(), user.getTokenVersion(), counts);
    }

    @Transactional
    public void setEmailVerified(Long id, boolean verified) {
        User user = require(id);
        user.setEmailVerified(verified);
        userRepository.save(user);
    }

    @Transactional
    public void revokeSessions(Long id) {
        User user = require(id);
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }

    public ResetLink resetLink(Long id) {
        User user = require(id);
        String token = accountTokenService.issue(user, AccountTokenType.PASSWORD_RESET);
        return new ResetLink(
                baseUrl + "/reset-password?token=" + token,
                Instant.now().plus(Duration.ofHours(1)));
    }

    public ResetLink verifyLink(Long id) {
        User user = require(id);
        String token = accountTokenService.issue(user, AccountTokenType.EMAIL_VERIFY);
        return new ResetLink(
                baseUrl + "/verify-email?token=" + token,
                Instant.now().plus(Duration.ofHours(24)));
    }

    @Transactional
    public void delete(Long id) {
        User user = require(id);
        if (adminGuard.isAdmin(user)) {
            throw new BadRequestException("You can't delete the admin account from here");
        }
        userRepository.delete(user);
    }

    private User require(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }
}
