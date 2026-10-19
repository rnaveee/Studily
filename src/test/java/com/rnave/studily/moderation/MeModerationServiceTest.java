package com.rnave.studily.moderation;

import com.rnave.studily.admin.AdminGuard;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.moderation.MeModerationService.MeModerationDto;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeModerationServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-19T12:00:00Z");

    private ModerationActionRepository actions;
    private CurrentUser currentUser;
    private AdminGuard adminGuard;
    private MeModerationService service;
    private User me;

    @BeforeEach
    void setUp() {
        actions = mock(ModerationActionRepository.class);
        currentUser = mock(CurrentUser.class);
        adminGuard = mock(AdminGuard.class);
        service = new MeModerationService(actions, currentUser, adminGuard,
                Clock.fixed(NOW, ZoneOffset.UTC), "help@example.com");
        me = new User();
        me.setId(7L);
        me.setUsername("me");
        when(currentUser.id()).thenReturn(7L);
        when(currentUser.entity()).thenReturn(me);
    }

    @Test
    void acknowledge_scopesToCurrentUser() {
        service.acknowledge(List.of(1L, 2L));

        verify(actions).acknowledge(7L, List.of(1L, 2L), ModerationActionType.WARNING, NOW);
    }

    @Test
    void acknowledge_emptyIsNoop() {
        service.acknowledge(List.of());

        verify(actions, never()).acknowledge(any(), anyCollection(), any(), any());
    }

    @Test
    void current_showsActiveRestrictionReasons() {
        me.setSuspendedUntil(NOW.plusSeconds(3600));
        ModerationAction a = new ModerationAction();
        a.setId(3L);
        a.setReasons(List.of(ReportReason.HARASSMENT));
        a.setNote("be nice");
        a.setCreatedAt(NOW.minusSeconds(60));
        when(actions.findActive(any(), anyCollection(), any())).thenReturn(List.of(a));

        MeModerationDto dto = service.current();

        assertThat(dto.status()).isEqualTo("SUSPENDED");
        assertThat(dto.reasons()).containsExactly(ReportReason.HARASSMENT);
        assertThat(dto.note()).isEqualTo("be nice");
        assertThat(dto.suspendedAt()).isEqualTo(NOW.minusSeconds(60));
        assertThat(dto.suspendedUntil()).isEqualTo(NOW.plusSeconds(3600));
        assertThat(dto.supportEmail()).isEqualTo("help@example.com");
    }

    @Test
    void current_goodUserSeesPendingWarnings() {
        ModerationAction w = new ModerationAction();
        w.setId(4L);
        w.setReasons(List.of(ReportReason.SPAM));
        w.setCreatedAt(NOW);
        when(actions.findByUserIdAndTypeAndAcknowledgedAtIsNullAndRevokedAtIsNullOrderByCreatedAtAsc(
                7L, ModerationActionType.WARNING)).thenReturn(List.of(w));

        MeModerationDto dto = service.current();

        assertThat(dto.status()).isEqualTo("GOOD");
        assertThat(dto.warnings()).hasSize(1);
        assertThat(dto.warnings().get(0).id()).isEqualTo(4L);
    }

    @Test
    void current_adminIsAlwaysGood() {
        me.setBanned(true);
        when(adminGuard.isAdmin(me)).thenReturn(true);

        MeModerationDto dto = service.current();

        assertThat(dto.status()).isEqualTo("GOOD");
        assertThat(dto.banned()).isFalse();
        assertThat(dto.warnings()).isEmpty();
    }
}
