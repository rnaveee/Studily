package com.rnave.studily.moderation;

import com.rnave.studily.admin.AdminGuard;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Service
public class MeModerationService {

    private static final List<ModerationActionType> RESTRICTIONS =
            List.of(ModerationActionType.SUSPENSION, ModerationActionType.BAN);

    private final ModerationActionRepository actionRepository;
    private final CurrentUser currentUser;
    private final AdminGuard adminGuard;
    private final Clock clock;
    private final String supportEmail;

    public MeModerationService(ModerationActionRepository actionRepository, CurrentUser currentUser,
                               AdminGuard adminGuard, Clock clock,
                               @Value("${app.support.email}") String supportEmail) {
        this.actionRepository = actionRepository;
        this.currentUser = currentUser;
        this.adminGuard = adminGuard;
        this.clock = clock;
        this.supportEmail = supportEmail;
    }

    @Transactional(readOnly = true)
    public MeModerationDto current() {
        User user = currentUser.entity();
        Instant now = clock.instant();
        if (adminGuard.isAdmin(user)) {
            return new MeModerationDto("GOOD", false, null, null, List.of(), null, supportEmail, List.of());
        }
        boolean suspended = user.isSuspendedAt(now);
        ModerationAction active = suspended
                ? actionRepository.findActive(user.getId(), RESTRICTIONS, now).stream().findFirst().orElse(null)
                : null;
        List<WarningDto> warnings = actionRepository
                .findByUserIdAndTypeAndAcknowledgedAtIsNullAndRevokedAtIsNullOrderByCreatedAtAsc(
                        user.getId(), ModerationActionType.WARNING)
                .stream()
                .map(a -> new WarningDto(a.getId(), a.getReasons(), a.getNote(), a.getCreatedAt()))
                .toList();
        return new MeModerationDto(
                suspended ? "SUSPENDED" : "GOOD",
                suspended && user.isBanned(),
                suspended ? user.getSuspendedUntil() : null,
                active == null ? null : active.getCreatedAt(),
                active == null ? List.of() : active.getReasons(),
                active == null ? null : active.getNote(),
                supportEmail,
                warnings);
    }

    @Transactional
    public void acknowledge(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        actionRepository.acknowledge(currentUser.id(), ids, ModerationActionType.WARNING, clock.instant());
    }

    public record MeModerationDto(
            String status,
            boolean banned,
            Instant suspendedUntil,
            Instant suspendedAt,
            List<ReportReason> reasons,
            String note,
            String supportEmail,
            List<WarningDto> warnings) {
    }

    public record WarningDto(Long id, List<ReportReason> reasons, String note, Instant createdAt) {
    }
}
