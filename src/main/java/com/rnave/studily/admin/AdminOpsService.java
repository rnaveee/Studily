package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.AuditRow;
import com.rnave.studily.admin.AdminDtos.BroadcastRequest;
import com.rnave.studily.admin.AdminDtos.BroadcastResult;
import com.rnave.studily.admin.AdminDtos.Health;
import com.rnave.studily.admin.AdminDtos.Paged;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.mail.MailService;
import com.rnave.studily.notification.Notification;
import com.rnave.studily.notification.NotificationRepository;
import com.rnave.studily.notification.NotificationType;
import com.rnave.studily.push.PushPayload;
import com.rnave.studily.push.WebPushSender;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.List;

@Service
public class AdminOpsService {

    private static final int MAX_TITLE = 80;
    private static final int MAX_BODY = 240;

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final WebPushSender webPushSender;
    private final MailService mailService;
    private final AdminSessionService sessionService;
    private final AdminAuditLogRepository auditLogRepository;
    private final String sentryDsn;
    private final String timezone;

    public AdminOpsService(JdbcTemplate jdbc, UserRepository userRepository,
                           NotificationRepository notificationRepository, WebPushSender webPushSender,
                           MailService mailService, AdminSessionService sessionService,
                           AdminAuditLogRepository auditLogRepository,
                           @Value("${app.sentry.dsn:}") String sentryDsn,
                           @Value("${app.timezone}") String timezone) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.webPushSender = webPushSender;
        this.mailService = mailService;
        this.sessionService = sessionService;
        this.auditLogRepository = auditLogRepository;
        this.sentryDsn = sentryDsn == null ? "" : sentryDsn.trim();
        this.timezone = timezone;
    }

    public Health health() {
        long started = System.nanoTime();
        String version = jdbc.queryForObject("SELECT version()", String.class);
        long latency = (System.nanoTime() - started) / 1_000_000;

        String size = jdbc.queryForObject(
                "SELECT pg_size_pretty(pg_database_size(current_database()))", String.class);
        Long schemaVersion = jdbc.queryForObject("""
                SELECT coalesce(max(cast(version AS numeric)), 0)::bigint
                FROM flyway_schema_history WHERE success
                """, Long.class);

        Runtime runtime = Runtime.getRuntime();
        long heapUsed = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long heapMax = runtime.maxMemory() / (1024 * 1024);

        return new Health(
                latency < 500 ? "ok" : "slow",
                latency,
                shortVersion(version),
                size,
                schemaVersion == null ? 0 : schemaVersion,
                ManagementFactory.getRuntimeMXBean().getUptime(),
                heapUsed,
                heapMax,
                runtime.availableProcessors(),
                mailService.enabled(),
                webPushSender.isEnabled(),
                !sentryDsn.isEmpty(),
                sessionService.totpEnabled(),
                timezone);
    }

    private static String shortVersion(String full) {
        if (full == null) {
            return "unknown";
        }
        int comma = full.indexOf(',');
        return comma > 0 ? full.substring(0, comma) : full;
    }

    @Transactional
    public BroadcastResult broadcast(BroadcastRequest request) {
        String title = trimmed(request.title(), MAX_TITLE, "Title");
        String body = trimmed(request.body(), MAX_BODY, "Message");
        String url = request.url() == null || request.url().isBlank() ? "/dashboard" : request.url().trim();

        List<Long> targets = request.onlyActive()
                ? jdbc.queryForList(
                        "SELECT id FROM users WHERE last_active_at >= now() - interval '30 days'", Long.class)
                : jdbc.queryForList("SELECT id FROM users", Long.class);

        String dedupKey = "announce:" + Instant.now().toEpochMilli();
        int sent = 0;
        for (Long userId : targets) {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) {
                continue;
            }
            Notification notification = new Notification();
            notification.setUser(user);
            notification.setType(NotificationType.ANNOUNCEMENT);
            notification.setMessage(body);
            notification.setDedupKey(dedupKey);
            notificationRepository.save(notification);
            webPushSender.sendToUser(
                    userId, PushPayload.of(title, body, url), NotificationType.ANNOUNCEMENT.pushTtlSeconds());
            sent++;
        }
        return new BroadcastResult(sent);
    }

    private static String trimmed(String value, int max, String field) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(field + " is required");
        }
        String clean = value.trim();
        if (clean.length() > max) {
            throw new BadRequestException(field + " must be " + max + " characters or fewer");
        }
        return clean;
    }

    public Paged<AuditRow> audit(int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        var slice = auditLogRepository.findAllByOrderByCreatedAtDescIdDesc(
                PageRequest.of(Math.max(page, 0), safeSize));
        List<AuditRow> rows = slice.getContent().stream()
                .map(entry -> new AuditRow(
                        entry.getId(), entry.getActorName(), entry.getAction(), entry.getTarget(),
                        entry.getDetail(), entry.getIp(), entry.getCreatedAt()))
                .toList();
        return new Paged<>(rows, slice.hasNext(), auditLogRepository.count());
    }
}
