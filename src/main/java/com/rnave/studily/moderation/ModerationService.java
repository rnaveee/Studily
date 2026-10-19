package com.rnave.studily.moderation;

import com.rnave.studily.admin.AdminDtos.ModerationRequest;
import com.rnave.studily.admin.AdminDtos.ModerationResult;
import com.rnave.studily.admin.AdminGuard;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.conversation.ConversationService;
import com.rnave.studily.conversation.ws.WsSessionRegistry;
import com.rnave.studily.user.AvatarService;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class ModerationService {

    private static final List<ModerationActionType> RESTRICTIONS =
            List.of(ModerationActionType.SUSPENSION, ModerationActionType.BAN);
    private static final int MAX_DAYS = 365;
    private static final int MAX_REASONS = 8;
    private static final int MAX_NOTE = 500;
    private static final int MAX_DELETE_MESSAGES = 50;
    private static final int MAX_REPORTS = 200;

    private final UserRepository userRepository;
    private final ModerationActionRepository actionRepository;
    private final ReportRepository reportRepository;
    private final BannedEmails bannedEmails;
    private final AvatarService avatarService;
    private final ConversationService conversationService;
    private final WsSessionRegistry wsSessionRegistry;
    private final AdminGuard adminGuard;
    private final Clock clock;

    public ModerationService(UserRepository userRepository, ModerationActionRepository actionRepository,
                             ReportRepository reportRepository, BannedEmails bannedEmails,
                             AvatarService avatarService, ConversationService conversationService,
                             WsSessionRegistry wsSessionRegistry, AdminGuard adminGuard, Clock clock) {
        this.userRepository = userRepository;
        this.actionRepository = actionRepository;
        this.reportRepository = reportRepository;
        this.bannedEmails = bannedEmails;
        this.avatarService = avatarService;
        this.conversationService = conversationService;
        this.wsSessionRegistry = wsSessionRegistry;
        this.adminGuard = adminGuard;
        this.clock = clock;
    }

    @Transactional
    public ModerationResult apply(User admin, Long targetId, ModerationRequest req) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (adminGuard.isAdmin(target)) {
            throw new BadRequestException("You can't moderate the admin account");
        }
        ModerationActionType type = req.type();
        Integer days = req.days();
        if (type == ModerationActionType.SUSPENSION) {
            if (days == null || days < 1 || days > MAX_DAYS) {
                throw new BadRequestException("Suspension length must be between 1 and " + MAX_DAYS + " days");
            }
        } else if (days != null) {
            throw new BadRequestException("Only suspensions have a length");
        }
        List<ReportReason> reasons = req.reasons() == null ? List.of() : req.reasons();
        if (reasons.isEmpty() || reasons.size() > MAX_REASONS || new LinkedHashSet<>(reasons).size() != reasons.size()) {
            throw new BadRequestException("Pick at least one reason");
        }
        String note = req.note() == null ? null : req.note().trim();
        if (note != null && note.isEmpty()) {
            note = null;
        }
        if (note != null && note.length() > MAX_NOTE) {
            throw new BadRequestException("Note is too long");
        }
        List<Long> messageIds = distinct(req.deleteMessageIds());
        if (messageIds.size() > MAX_DELETE_MESSAGES) {
            throw new BadRequestException("Too many messages to delete");
        }
        List<Report> reports = loadOpenReports(targetId, distinct(req.reportIds()));

        Instant now = clock.instant();
        boolean restricting = type != ModerationActionType.WARNING;
        List<ModerationAction> superseded = restricting
                ? actionRepository.findActive(targetId, RESTRICTIONS, now)
                : List.of();

        ModerationAction action = new ModerationAction();
        action.setUserId(targetId);
        action.setUsername(target.getUsername());
        action.setType(type);
        action.setReasons(List.copyOf(reasons));
        action.setNote(note);
        action.setCreatedById(admin.getId());
        action.setCreatedByName(admin.getUsername());
        action.setCreatedAt(now);
        if (type == ModerationActionType.SUSPENSION) {
            action.setEndsAt(now.plus(Duration.ofDays(days)));
        }

        if (req.removeAvatar() && target.getAvatarImage() != null) {
            avatarService.clear(target);
            action.setRemovedAvatar(true);
        }
        if (req.clearBio() && target.getBio() != null && !target.getBio().isBlank()) {
            target.setBio(null);
            action.setClearedBio(true);
        }
        int deleted = 0;
        for (Long messageId : messageIds) {
            if (conversationService.deleteMessageAsModerator(messageId, targetId)) {
                deleted++;
            }
        }
        action.setDeletedMessages(deleted);

        if (restricting) {
            for (ModerationAction old : superseded) {
                old.setRevokedAt(now);
                old.setRevokedByName("superseded");
            }
            if (type == ModerationActionType.BAN) {
                target.setBanned(true);
                target.setSuspendedUntil(null);
                bannedEmails.ban(target);
            } else {
                target.setBanned(false);
                target.setSuspendedUntil(action.getEndsAt());
                bannedEmails.unban(targetId);
            }
        }
        action = actionRepository.save(action);
        userRepository.save(target);

        for (Report report : reports) {
            report.setStatus(ReportStatus.ACTIONED);
            report.setResolvedAt(now);
            report.setResolvedByName(admin.getUsername());
            report.setActionId(action.getId());
        }
        reportRepository.saveAll(reports);

        if (restricting) {
            closeSocketsAfterCommit(targetId);
        }
        return new ModerationResult(
                action.getId(),
                target.isSuspendedAt(now) ? "SUSPENDED" : "GOOD",
                target.isBanned(),
                target.getSuspendedUntil(),
                deleted);
    }

    @Transactional
    public void lift(User admin, Long targetId) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Instant now = clock.instant();
        if (!target.isSuspendedAt(now)) {
            throw new BadRequestException("This account isn't suspended");
        }
        for (ModerationAction action : actionRepository.findActive(targetId, RESTRICTIONS, now)) {
            action.setRevokedAt(now);
            action.setRevokedByName(admin.getUsername());
        }
        target.setBanned(false);
        target.setSuspendedUntil(null);
        userRepository.save(target);
        bannedEmails.unban(targetId);
    }

    @Transactional
    public void dismiss(User admin, Long targetId, List<Long> reportIds) {
        List<Long> ids = distinct(reportIds);
        List<Report> reports = ids.isEmpty()
                ? reportRepository.findByTargetUserIdAndStatus(targetId, ReportStatus.OPEN)
                : loadOpenReports(targetId, ids);
        Instant now = clock.instant();
        for (Report report : reports) {
            report.setStatus(ReportStatus.DISMISSED);
            report.setResolvedAt(now);
            report.setResolvedByName(admin.getUsername());
        }
        reportRepository.saveAll(reports);
    }

    private List<Report> loadOpenReports(Long targetId, List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        if (ids.size() > MAX_REPORTS) {
            throw new BadRequestException("Too many reports selected");
        }
        List<Report> reports = reportRepository.findAllById(ids);
        boolean valid = reports.size() == ids.size() && reports.stream()
                .allMatch(r -> r.getStatus() == ReportStatus.OPEN && targetId.equals(r.getTargetUserId()));
        if (!valid) {
            throw new BadRequestException("Some of those reports can't be resolved for this user");
        }
        return reports;
    }

    private static List<Long> distinct(List<Long> ids) {
        return ids == null ? List.of() : ids.stream().filter(java.util.Objects::nonNull).distinct().toList();
    }

    private void closeSocketsAfterCommit(Long targetId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                wsSessionRegistry.closeAllForUser(targetId, WsSessionRegistry.SUSPENDED);
            }
        });
    }
}
