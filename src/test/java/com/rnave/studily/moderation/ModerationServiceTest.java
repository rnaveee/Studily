package com.rnave.studily.moderation;

import com.rnave.studily.admin.AdminDtos.ModerationRequest;
import com.rnave.studily.admin.AdminDtos.ModerationResult;
import com.rnave.studily.admin.AdminGuard;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.conversation.ConversationService;
import com.rnave.studily.conversation.ws.WsSessionRegistry;
import com.rnave.studily.user.AvatarService;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ModerationServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-19T12:00:00Z");

    private UserRepository users;
    private ModerationActionRepository actions;
    private ReportRepository reports;
    private BannedEmails bannedEmails;
    private AvatarService avatarService;
    private ConversationService conversationService;
    private WsSessionRegistry registry;
    private AdminGuard adminGuard;
    private ModerationService service;
    private User admin;
    private User target;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        actions = mock(ModerationActionRepository.class);
        reports = mock(ReportRepository.class);
        bannedEmails = mock(BannedEmails.class);
        avatarService = mock(AvatarService.class);
        conversationService = mock(ConversationService.class);
        registry = mock(WsSessionRegistry.class);
        adminGuard = mock(AdminGuard.class);
        service = new ModerationService(users, actions, reports, bannedEmails, avatarService,
                conversationService, registry, adminGuard, Clock.fixed(NOW, ZoneOffset.UTC));
        admin = user(1L, "boss");
        target = user(2L, "target");
        when(adminGuard.isAdmin(admin)).thenReturn(true);
        when(users.findById(2L)).thenReturn(Optional.of(target));
        when(actions.save(any(ModerationAction.class))).thenAnswer(inv -> {
            ModerationAction a = inv.getArgument(0);
            a.setId(77L);
            return a;
        });
        when(actions.findActive(any(), anyCollection(), any())).thenReturn(List.of());
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void tearDown() {
        TransactionSynchronizationManager.clearSynchronization();
    }

    private static ModerationRequest req(ModerationActionType type, Integer days, List<ReportReason> reasons) {
        return new ModerationRequest(type, days, reasons, null, false, false, null, null);
    }

    private static ModerationRequest req(ModerationActionType type, Integer days, boolean avatar, boolean bio,
                                         List<Long> messages, List<Long> reportIds) {
        return new ModerationRequest(type, days, List.of(ReportReason.SPAM), "  note  ", avatar, bio,
                messages, reportIds);
    }

    @Test
    void suspension_setsUntilFromClockAndSavesAction() {
        ModerationResult result = service.apply(admin, 2L,
                req(ModerationActionType.SUSPENSION, 7, List.of(ReportReason.HARASSMENT)));

        assertThat(target.getSuspendedUntil()).isEqualTo(NOW.plusSeconds(7 * 86400L));
        assertThat(target.isBanned()).isFalse();
        ArgumentCaptor<ModerationAction> captor = ArgumentCaptor.forClass(ModerationAction.class);
        verify(actions).save(captor.capture());
        assertThat(captor.getValue().getEndsAt()).isEqualTo(NOW.plusSeconds(7 * 86400L));
        assertThat(captor.getValue().getCreatedByName()).isEqualTo("boss");
        assertThat(result.status()).isEqualTo("SUSPENDED");
        assertThat(result.actionId()).isEqualTo(77L);
        verify(bannedEmails).unban(2L);
    }

    @Test
    void ban_setsBannedClearsUntilAndBansEmail() {
        target.setSuspendedUntil(NOW.plusSeconds(100));

        ModerationResult result = service.apply(admin, 2L,
                req(ModerationActionType.BAN, null, List.of(ReportReason.HATE_SPEECH)));

        assertThat(target.isBanned()).isTrue();
        assertThat(target.getSuspendedUntil()).isNull();
        assertThat(result.banned()).isTrue();
        verify(bannedEmails).ban(target);
    }

    @Test
    void suspensionAfterBan_revokesBanAndUnbansEmail() {
        target.setBanned(true);
        ModerationAction oldBan = new ModerationAction();
        oldBan.setType(ModerationActionType.BAN);
        when(actions.findActive(any(), anyCollection(), any())).thenReturn(List.of(oldBan));

        service.apply(admin, 2L, req(ModerationActionType.SUSPENSION, 3, List.of(ReportReason.SPAM)));

        assertThat(target.isBanned()).isFalse();
        assertThat(oldBan.getRevokedAt()).isEqualTo(NOW);
        assertThat(oldBan.getRevokedByName()).isEqualTo("superseded");
        verify(bannedEmails).unban(2L);
    }

    @Test
    void warning_leavesAccountGood() {
        ModerationResult result = service.apply(admin, 2L,
                req(ModerationActionType.WARNING, null, List.of(ReportReason.SPAM)));

        assertThat(result.status()).isEqualTo("GOOD");
        assertThat(target.isSuspendedAt(NOW)).isFalse();
        verify(bannedEmails, never()).ban(any(User.class));
        verify(bannedEmails, never()).unban(any());
        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
    }

    @Test
    void adminTargetRefused() {
        when(users.findById(1L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.apply(admin, 1L,
                req(ModerationActionType.BAN, null, List.of(ReportReason.SPAM))))
                .isInstanceOf(BadRequestException.class);
        verify(actions, never()).save(any(ModerationAction.class));
        verify(users, never()).save(any(User.class));
    }

    @Test
    void daysValidation() {
        for (Integer days : new Integer[]{null, 0, 366, -1}) {
            assertThatThrownBy(() -> service.apply(admin, 2L,
                    req(ModerationActionType.SUSPENSION, days, List.of(ReportReason.SPAM))))
                    .isInstanceOf(BadRequestException.class);
        }
        assertThatThrownBy(() -> service.apply(admin, 2L,
                req(ModerationActionType.WARNING, 3, List.of(ReportReason.SPAM))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.apply(admin, 2L,
                req(ModerationActionType.BAN, 3, List.of(ReportReason.SPAM))))
                .isInstanceOf(BadRequestException.class);
        verify(actions, never()).save(any(ModerationAction.class));
    }

    @Test
    void reasonsRequiredAndDistinct() {
        assertThatThrownBy(() -> service.apply(admin, 2L, req(ModerationActionType.WARNING, null, List.of())))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.apply(admin, 2L, req(ModerationActionType.WARNING, null,
                List.of(ReportReason.SPAM, ReportReason.SPAM)))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void removalsAndMessageDeletes() {
        target.setAvatarImage(new byte[]{1});
        target.setBio("bad bio");
        when(conversationService.deleteMessageAsModerator(10L, 2L)).thenReturn(true);
        when(conversationService.deleteMessageAsModerator(11L, 2L)).thenReturn(false);

        ModerationResult result = service.apply(admin, 2L,
                req(ModerationActionType.WARNING, null, true, true, List.of(10L, 11L), null));

        verify(avatarService).clear(target);
        assertThat(target.getBio()).isNull();
        verify(conversationService).deleteMessageAsModerator(10L, 2L);
        verify(conversationService).deleteMessageAsModerator(11L, 2L);
        assertThat(result.deletedMessages()).isEqualTo(1);
        ArgumentCaptor<ModerationAction> captor = ArgumentCaptor.forClass(ModerationAction.class);
        verify(actions).save(captor.capture());
        assertThat(captor.getValue().isRemovedAvatar()).isTrue();
        assertThat(captor.getValue().isClearedBio()).isTrue();
        assertThat(captor.getValue().getNote()).isEqualTo("note");
    }

    @Test
    void removalsSkippedWhenNothingToRemove() {
        service.apply(admin, 2L, req(ModerationActionType.WARNING, null, true, true, null, null));

        verify(avatarService, never()).clear(any(User.class));
    }

    @Test
    void reportsOfAnotherUserRejected() {
        Report foreign = report(5L, 3L, ReportStatus.OPEN);
        when(reports.findAllById(List.of(5L))).thenReturn(List.of(foreign));

        assertThatThrownBy(() -> service.apply(admin, 2L,
                req(ModerationActionType.WARNING, null, false, false, null, List.of(5L))))
                .isInstanceOf(BadRequestException.class);
        verify(actions, never()).save(any(ModerationAction.class));
    }

    @Test
    void closedReportsRejected() {
        when(reports.findAllById(List.of(5L))).thenReturn(List.of(report(5L, 2L, ReportStatus.DISMISSED)));

        assertThatThrownBy(() -> service.apply(admin, 2L,
                req(ModerationActionType.WARNING, null, false, false, null, List.of(5L))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void reportsResolvedAsActioned() {
        Report r = report(5L, 2L, ReportStatus.OPEN);
        when(reports.findAllById(List.of(5L))).thenReturn(List.of(r));

        service.apply(admin, 2L, req(ModerationActionType.WARNING, null, false, false, null, List.of(5L)));

        assertThat(r.getStatus()).isEqualTo(ReportStatus.ACTIONED);
        assertThat(r.getResolvedAt()).isEqualTo(NOW);
        assertThat(r.getResolvedByName()).isEqualTo("boss");
        assertThat(r.getActionId()).isEqualTo(77L);
    }

    @Test
    void socketsCloseOnlyAfterCommit() {
        service.apply(admin, 2L, req(ModerationActionType.SUSPENSION, 1, List.of(ReportReason.SPAM)));

        verify(registry, never()).closeAllForUser(any(), any());
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(registry).closeAllForUser(2L, WsSessionRegistry.SUSPENDED);
    }

    @Test
    void lift_clearsBothColumnsRevokesAndUnbans() {
        target.setBanned(true);
        ModerationAction ban = new ModerationAction();
        when(actions.findActive(any(), anyCollection(), any())).thenReturn(List.of(ban));

        service.lift(admin, 2L);

        assertThat(target.isBanned()).isFalse();
        assertThat(target.getSuspendedUntil()).isNull();
        assertThat(ban.getRevokedAt()).isEqualTo(NOW);
        assertThat(ban.getRevokedByName()).isEqualTo("boss");
        verify(bannedEmails).unban(2L);
    }

    @Test
    void lift_whenNotSuspendedIsBadRequest() {
        assertThatThrownBy(() -> service.lift(admin, 2L)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void dismiss_nullDismissesAllOpenReports() {
        Report a = report(1L, 2L, ReportStatus.OPEN);
        Report b = report(2L, 2L, ReportStatus.OPEN);
        when(reports.findByTargetUserIdAndStatus(2L, ReportStatus.OPEN)).thenReturn(List.of(a, b));

        service.dismiss(admin, 2L, null);

        assertThat(a.getStatus()).isEqualTo(ReportStatus.DISMISSED);
        assertThat(b.getStatus()).isEqualTo(ReportStatus.DISMISSED);
        assertThat(a.getResolvedByName()).isEqualTo("boss");
    }

    @Test
    void dismiss_otherTargetsReportIsBadRequest() {
        when(reports.findAllById(List.of(9L))).thenReturn(List.of(report(9L, 3L, ReportStatus.OPEN)));

        assertThatThrownBy(() -> service.dismiss(admin, 2L, List.of(9L))).isInstanceOf(BadRequestException.class);
    }

    private static Report report(Long id, Long targetId, ReportStatus status) {
        Report r = new Report();
        r.setId(id);
        r.setTargetUserId(targetId);
        r.setStatus(status);
        return r;
    }

    private static User user(Long id, String username) {
        User u = new User();
        u.setId(id);
        u.setUsername(username);
        return u;
    }
}
