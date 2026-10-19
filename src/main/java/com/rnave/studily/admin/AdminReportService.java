package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.EvidenceContent;
import com.rnave.studily.admin.AdminDtos.Paged;
import com.rnave.studily.admin.AdminDtos.ReportCase;
import com.rnave.studily.admin.AdminDtos.ReportGroupRow;
import com.rnave.studily.admin.AdminDtos.ReportRow;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.conversation.MessageRepository;
import com.rnave.studily.moderation.Report;
import com.rnave.studily.moderation.ReportEvidence;
import com.rnave.studily.moderation.ReportEvidenceRepository;
import com.rnave.studily.moderation.ReportRepository;
import com.rnave.studily.user.AvatarUrls;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminReportService {

    private static final Set<String> EVIDENCE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");

    private final JdbcTemplate jdbc;
    private final ReportRepository reportRepository;
    private final ReportEvidenceRepository evidenceRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final AdminUserService userService;
    private final Clock clock;

    public AdminReportService(JdbcTemplate jdbc, ReportRepository reportRepository,
                              ReportEvidenceRepository evidenceRepository, MessageRepository messageRepository,
                              UserRepository userRepository, AdminUserService userService, Clock clock) {
        this.jdbc = jdbc;
        this.reportRepository = reportRepository;
        this.evidenceRepository = evidenceRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.userService = userService;
        this.clock = clock;
    }

    public Paged<ReportGroupRow> groups(boolean openOnly, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        String having = openOnly ? " HAVING count(*) FILTER (WHERE r.status = 'OPEN') > 0" : "";
        String grouped = "FROM reports r JOIN users u ON u.id = r.target_user_id GROUP BY u.id" + having;

        Long total = jdbc.queryForObject("SELECT count(*) FROM (SELECT u.id " + grouped + ") t", Long.class);
        Instant now = clock.instant();
        List<GroupBase> bases = jdbc.query(
                "SELECT u.id, u.username, u.name, u.avatar_key, (u.avatar_image IS NOT NULL) AS has_avatar, "
                        + "u.banned, u.suspended_until, "
                        + "count(*) FILTER (WHERE r.status = 'OPEN') AS open_count, count(*) AS total_count, "
                        + "max(r.created_at) AS latest_at " + grouped
                        + " ORDER BY (count(*) FILTER (WHERE r.status = 'OPEN') > 0) DESC, max(r.created_at) DESC, u.id"
                        + " LIMIT ? OFFSET ?",
                (rs, i) -> {
                    boolean banned = rs.getBoolean("banned");
                    Instant until = AdminAnalyticsService.instant(rs.getTimestamp("suspended_until"));
                    String avatarKey = rs.getBoolean("has_avatar") ? rs.getString("avatar_key") : null;
                    return new GroupBase(
                            rs.getLong("id"), rs.getString("username"), rs.getString("name"),
                            AvatarUrls.of(rs.getLong("id"), avatarKey),
                            banned || (until != null && until.isAfter(now)) ? "SUSPENDED" : "GOOD",
                            banned, until, rs.getLong("open_count"), rs.getLong("total_count"),
                            AdminAnalyticsService.instant(rs.getTimestamp("latest_at")));
                },
                safeSize, safePage * safeSize);

        Map<Long, Map<String, Long>> reasons = new LinkedHashMap<>();
        if (!bases.isEmpty()) {
            String placeholders = bases.stream().map(b -> "?").collect(Collectors.joining(","));
            jdbc.query(
                    "SELECT target_user_id, reason, count(*) AS n FROM reports "
                            + "WHERE status = 'OPEN' AND target_user_id IN (" + placeholders + ") "
                            + "GROUP BY target_user_id, reason ORDER BY n DESC, reason",
                    rs -> {
                        reasons.computeIfAbsent(rs.getLong("target_user_id"), k -> new LinkedHashMap<>())
                                .put(rs.getString("reason"), rs.getLong("n"));
                    },
                    bases.stream().map(GroupBase::userId).toArray());
        }

        List<ReportGroupRow> rows = bases.stream()
                .map(b -> new ReportGroupRow(
                        b.userId(), b.username(), b.name(), b.avatarUrl(), b.status(), b.banned(),
                        b.suspendedUntil(), b.openCount(), b.totalCount(),
                        reasons.getOrDefault(b.userId(), Map.of()), b.latestAt()))
                .toList();
        long count = total == null ? 0 : total;
        return new Paged<>(rows, (long) (safePage + 1) * safeSize < count, count);
    }

    @Transactional(readOnly = true)
    public ReportCase reportCase(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        List<Report> reports = reportRepository.findTop100ByTargetUserIdOrderByCreatedAtDesc(userId);

        Set<Long> existingMessages = new HashSet<>();
        List<Long> messageIds = reports.stream().map(Report::getMessageId).filter(java.util.Objects::nonNull).toList();
        if (!messageIds.isEmpty()) {
            existingMessages.addAll(messageRepository.findExistingIds(messageIds));
        }
        Set<Long> withEvidence = new HashSet<>();
        if (!reports.isEmpty()) {
            withEvidence.addAll(evidenceRepository.findExistingReportIds(
                    reports.stream().map(Report::getId).toList()));
        }

        List<ReportRow> rows = new ArrayList<>();
        for (Report r : reports) {
            rows.add(new ReportRow(
                    r.getId(), r.getKind().name(), r.getReason().name(), r.getDetails(), r.getStatus().name(),
                    r.getReporterId(), r.getReporterUsername(), r.getCreatedAt(), r.getMessageId(),
                    r.getConversationId(), r.getMessageBody(), r.getMessageAttachmentFilename(),
                    r.getMessageAttachmentContentType(), r.getMessageCreatedAt(),
                    r.getMessageId() != null && existingMessages.contains(r.getMessageId()),
                    withEvidence.contains(r.getId()), r.getTargetName(), r.getTargetBio(), r.getResolvedAt(),
                    r.getResolvedByName(), r.getActionId()));
        }
        return new ReportCase(
                userService.row(userId), user.getBio(), AvatarUrls.of(user), rows, userService.actions(userId));
    }

    @Transactional(readOnly = true)
    public EvidenceContent evidence(Long reportId) {
        ReportEvidence evidence = evidenceRepository.findById(reportId)
                .filter(e -> EVIDENCE_TYPES.contains(e.getContentType()))
                .orElseThrow(() -> new NotFoundException("No evidence"));
        return new EvidenceContent(evidence.getContentType(), evidence.getData());
    }

    private record GroupBase(
            Long userId,
            String username,
            String name,
            String avatarUrl,
            String status,
            boolean banned,
            Instant suspendedUntil,
            long openCount,
            long totalCount,
            Instant latestAt) {
    }
}
