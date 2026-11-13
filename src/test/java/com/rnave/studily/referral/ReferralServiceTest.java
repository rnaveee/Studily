package com.rnave.studily.referral;

import com.rnave.studily.notification.NotificationDispatcher;
import com.rnave.studily.notification.NotificationType;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ChestTier;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserProgress;
import com.rnave.studily.progress.XpEventRepository;
import com.rnave.studily.progress.XpSource;
import com.rnave.studily.support.SupporterBadge;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReferralServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-12T12:00:00Z");
    private static final Long INVITER_ID = 1L;
    private static final Long INVITEE_ID = 2L;
    private static final Long REFERRAL_ID = 100L;

    private ReferralRepository referralRepository;
    private ReferralCodeRepository codeRepository;
    private UserRepository userRepository;
    private XpEventRepository xpEventRepository;
    private ProgressService progressService;
    private SupporterBadge supporterBadge;
    private NotificationDispatcher dispatcher;
    private ReferralService service;

    private User inviter;
    private User invitee;
    private Referral referral;
    private ProgressDeltaBuilder inviterDelta;
    private ProgressDeltaBuilder inviteeDelta;

    @BeforeEach
    void setUp() {
        referralRepository = mock(ReferralRepository.class);
        codeRepository = mock(ReferralCodeRepository.class);
        userRepository = mock(UserRepository.class);
        xpEventRepository = mock(XpEventRepository.class);
        progressService = mock(ProgressService.class);
        supporterBadge = mock(SupporterBadge.class);
        dispatcher = mock(NotificationDispatcher.class);
        service = new ReferralService(referralRepository, codeRepository, userRepository, xpEventRepository,
                progressService, supporterBadge, dispatcher, Clock.fixed(NOW, ZoneOffset.UTC),
                mock(PlatformTransactionManager.class), "https://studily.ca/");

        inviter = user(INVITER_ID, "first.last@gmail.com", "First Last", true);
        invitee = user(INVITEE_ID, "friend@example.com", "Friend", true);
        invitee.setCreatedAt(NOW.minus(Duration.ofDays(2)));

        referral = new Referral();
        referral.setId(REFERRAL_ID);
        referral.setInviterId(INVITER_ID);
        referral.setInviteeId(INVITEE_ID);

        inviterDelta = new ProgressDeltaBuilder(progress(INVITER_ID));
        inviteeDelta = new ProgressDeltaBuilder(progress(INVITEE_ID));

        when(userRepository.findById(INVITER_ID)).thenReturn(Optional.of(inviter));
        when(userRepository.findById(INVITEE_ID)).thenReturn(Optional.of(invitee));
        when(referralRepository.findById(REFERRAL_ID)).thenReturn(Optional.of(referral));
        when(xpEventRepository.existsByUserIdAndSourceNot(INVITEE_ID, XpSource.FRIEND)).thenReturn(true);
        when(referralRepository.countByInviterIdAndStatus(INVITER_ID, ReferralStatus.REWARDED)).thenReturn(0L);
        when(referralRepository.claim(eq(REFERRAL_ID), any(Instant.class))).thenReturn(1);
        when(progressService.begin(INVITER_ID)).thenReturn(inviterDelta);
        when(progressService.begin(INVITEE_ID)).thenReturn(inviteeDelta);
    }

    @Test
    void recordSignup_rejectsSelfInviteThroughANormalizedGmailAlias() {
        User alias = user(INVITEE_ID, "firstlast+promo@googlemail.com", "Alias", false);
        when(codeRepository.findByCode("ABCD2345")).thenReturn(Optional.of(codeOwnedBy(INVITER_ID)));

        service.recordSignup(alias, "ABCD2345");

        verify(referralRepository, never()).insertPending(anyLong(), anyLong(), any());
    }

    @Test
    void recordSignup_ignoresAnUnknownCode() {
        when(codeRepository.findByCode("ZZZZZZZZ")).thenReturn(Optional.empty());

        service.recordSignup(invitee, "ZZZZZZZZ");

        verify(referralRepository, never()).insertPending(anyLong(), anyLong(), any());
    }

    @Test
    void recordSignup_ignoresBlankAndMissingCodes() {
        service.recordSignup(invitee, null);
        service.recordSignup(invitee, "   ");

        verify(codeRepository, never()).findByCode(anyString());
        verify(referralRepository, never()).insertPending(anyLong(), anyLong(), any());
    }

    @Test
    void recordSignup_ignoresABannedInviter() {
        inviter.setBanned(true);
        when(codeRepository.findByCode("ABCD2345")).thenReturn(Optional.of(codeOwnedBy(INVITER_ID)));

        service.recordSignup(invitee, "ABCD2345");

        verify(referralRepository, never()).insertPending(anyLong(), anyLong(), any());
    }

    @Test
    void recordSignup_ignoresASuspendedInviter() {
        inviter.setSuspendedUntil(NOW.plus(Duration.ofDays(1)));
        when(codeRepository.findByCode("ABCD2345")).thenReturn(Optional.of(codeOwnedBy(INVITER_ID)));

        service.recordSignup(invitee, "ABCD2345");

        verify(referralRepository, never()).insertPending(anyLong(), anyLong(), any());
    }

    @Test
    void recordSignup_insertsAPendingRowForAValidCodeCaseInsensitively() {
        when(codeRepository.findByCode("ABCD2345")).thenReturn(Optional.of(codeOwnedBy(INVITER_ID)));

        service.recordSignup(invitee, " abcd2345 ");

        verify(referralRepository).insertPending(INVITER_ID, INVITEE_ID, NOW);
    }

    @Test
    void evaluate_unverifiedInviteeStaysPending() {
        invitee.setEmailVerified(false);

        service.evaluate(REFERRAL_ID);

        assertStillPending();
    }

    @Test
    void evaluate_inviteeWithoutNonFriendXpStaysPending() {
        when(xpEventRepository.existsByUserIdAndSourceNot(INVITEE_ID, XpSource.FRIEND)).thenReturn(false);

        service.evaluate(REFERRAL_ID);

        assertStillPending();
    }

    @Test
    void evaluate_unverifiedInviterStaysPending() {
        inviter.setEmailVerified(false);

        service.evaluate(REFERRAL_ID);

        assertStillPending();
    }

    @Test
    void evaluate_suspendedInviterStaysPending() {
        inviter.setSuspendedUntil(NOW.plus(Duration.ofDays(1)));

        service.evaluate(REFERRAL_ID);

        assertStillPending();
    }

    @Test
    void evaluate_accountOlderThanThirtyDaysIsRejectedAsExpired() {
        invitee.setCreatedAt(NOW.minus(Duration.ofDays(31)));

        service.evaluate(REFERRAL_ID);

        verify(referralRepository).reject(REFERRAL_ID, "expired");
        verify(referralRepository, never()).claim(anyLong(), any());
        verify(dispatcher, never()).dispatch(any(), any(), any(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void evaluate_accountExactlyThirtyDaysOldStillQualifies() {
        invitee.setCreatedAt(NOW.minus(Duration.ofDays(30)));

        service.evaluate(REFERRAL_ID);

        verify(referralRepository).claim(eq(REFERRAL_ID), any(Instant.class));
        verify(referralRepository, never()).reject(anyLong(), anyString());
    }

    @Test
    void evaluate_inviterAtTheCapIsRejectedAndGetsNothing() {
        when(referralRepository.countByInviterIdAndStatus(INVITER_ID, ReferralStatus.REWARDED))
                .thenReturn((long) ReferralService.CAP);

        service.evaluate(REFERRAL_ID);

        verify(referralRepository).reject(REFERRAL_ID, "cap");
        verify(referralRepository, never()).claim(anyLong(), any());
        verify(progressService, never()).grantChest(any(), any(), anyString(), any(), any());
        verify(supporterBadge, never()).grantIfMissing(anyLong(), any());
    }

    @Test
    void evaluate_successfulPayoutGrantsTwoGoldChestsTheBadgeAndTwoNotifications() {
        service.evaluate(REFERRAL_ID);

        verify(progressService).grantChest(inviterDelta, ChestSource.REFERRAL, "referral:" + INVITEE_ID, null, ChestTier.GOLD);
        verify(progressService).grantChest(inviteeDelta, ChestSource.REFERRAL, "referred", null, ChestTier.GOLD);
        verify(supporterBadge).grantIfMissing(INVITER_ID, inviterDelta);
        verify(progressService).finish(inviterDelta);
        verify(progressService).finish(inviteeDelta);
        verify(progressService, times(2)).grantChest(any(), eq(ChestSource.REFERRAL), anyString(), isNull(), eq(ChestTier.GOLD));

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(dispatcher).dispatch(eq(inviter), eq(NotificationType.REFERRAL_REWARD), isNull(),
                keys.capture(), anyString(), anyString(), eq("/support-studily"));
        verify(dispatcher).dispatch(eq(invitee), eq(NotificationType.REFERRAL_REWARD), isNull(),
                keys.capture(), anyString(), anyString(), eq("/support-studily"));
        assertThat(keys.getAllValues()).containsExactly("REFERRAL:100:inviter", "REFERRAL:100:invitee");
    }

    @Test
    void evaluate_locksBothProgressRowsInIdOrderEvenWhenTheInviterHasTheHigherId() {
        inviter.setId(5L);
        invitee.setId(3L);
        referral.setInviterId(5L);
        referral.setInviteeId(3L);
        when(userRepository.findById(5L)).thenReturn(Optional.of(inviter));
        when(userRepository.findById(3L)).thenReturn(Optional.of(invitee));
        when(xpEventRepository.existsByUserIdAndSourceNot(3L, XpSource.FRIEND)).thenReturn(true);
        when(referralRepository.countByInviterIdAndStatus(5L, ReferralStatus.REWARDED)).thenReturn(0L);
        when(progressService.begin(5L)).thenReturn(new ProgressDeltaBuilder(progress(5L)));
        when(progressService.begin(3L)).thenReturn(new ProgressDeltaBuilder(progress(3L)));

        service.evaluate(REFERRAL_ID);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(progressService);
        order.verify(progressService).begin(3L);
        order.verify(progressService).begin(5L);
    }

    @Test
    void evaluate_aSecondEvaluationIsANoOpBecauseTheClaimReturnsZero() {
        when(referralRepository.claim(eq(REFERRAL_ID), any(Instant.class))).thenReturn(0);

        service.evaluate(REFERRAL_ID);

        verify(progressService, never()).grantChest(any(), any(), anyString(), any(), any());
        verify(supporterBadge, never()).grantIfMissing(anyLong(), any());
        verify(dispatcher, never()).dispatch(any(), any(), any(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void evaluate_anAlreadyRewardedReferralIsSkippedWithoutTouchingProgress() {
        referral.setStatus(ReferralStatus.REWARDED);

        service.evaluate(REFERRAL_ID);

        verify(progressService, never()).begin(anyLong());
        verify(referralRepository, never()).claim(anyLong(), any());
    }

    @Test
    void evaluate_aFailingNotificationDoesNotUndoThePayout() {
        org.mockito.Mockito.doThrow(new IllegalStateException("push down")).when(dispatcher)
                .dispatch(any(), any(), any(), anyString(), anyString(), anyString(), anyString());

        service.evaluate(REFERRAL_ID);

        verify(progressService).grantChest(inviterDelta, ChestSource.REFERRAL, "referral:" + INVITEE_ID, null, ChestTier.GOLD);
        verify(dispatcher, times(2)).dispatch(any(), any(), any(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void codeFor_createsAnEightCharacterUnambiguousCodeOnFirstUse() {
        ReferralCode saved = codeOwnedBy(INVITER_ID);
        saved.setCode("PLACEHOLD");
        when(codeRepository.findById(INVITER_ID)).thenReturn(Optional.empty(), Optional.of(saved));

        String code = service.codeFor(INVITER_ID);

        ArgumentCaptor<String> inserted = ArgumentCaptor.forClass(String.class);
        verify(codeRepository).insertIfAbsent(eq(INVITER_ID), inserted.capture());
        assertThat(inserted.getValue()).matches("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}");
        assertThat(code).isEqualTo("PLACEHOLD");
    }

    @Test
    void codeFor_returnsTheExistingCodeWithoutInserting() {
        ReferralCode existing = codeOwnedBy(INVITER_ID);
        existing.setCode("ABCD2345");
        when(codeRepository.findById(INVITER_ID)).thenReturn(Optional.of(existing));

        assertThat(service.codeFor(INVITER_ID)).isEqualTo("ABCD2345");
        verify(codeRepository, never()).insertIfAbsent(anyLong(), anyString());
    }

    @Test
    void codeFor_retriesAfterACodeCollision() {
        ReferralCode saved = codeOwnedBy(INVITER_ID);
        saved.setCode("WINNER22");
        when(codeRepository.findById(INVITER_ID)).thenReturn(Optional.empty(), Optional.empty(), Optional.of(saved));
        when(codeRepository.insertIfAbsent(eq(INVITER_ID), anyString())).thenReturn(0, 1);

        assertThat(service.codeFor(INVITER_ID)).isEqualTo("WINNER22");
        verify(codeRepository, times(2)).insertIfAbsent(eq(INVITER_ID), anyString());
    }

    @Test
    void me_buildsTheLinkAndCountsFromTheRepository() {
        ReferralCode existing = codeOwnedBy(INVITER_ID);
        existing.setCode("ABCD2345");
        when(codeRepository.findById(INVITER_ID)).thenReturn(Optional.of(existing));
        when(referralRepository.countByInviterId(INVITER_ID)).thenReturn(4L);
        when(referralRepository.countByInviterIdAndStatus(INVITER_ID, ReferralStatus.PENDING)).thenReturn(2L);
        when(referralRepository.countByInviterIdAndStatus(INVITER_ID, ReferralStatus.REWARDED)).thenReturn(1L);

        var dto = service.me(INVITER_ID);

        assertThat(dto.code()).isEqualTo("ABCD2345");
        assertThat(dto.link()).isEqualTo("https://studily.ca/invite/ABCD2345");
        assertThat(dto.joined()).isEqualTo(4L);
        assertThat(dto.pending()).isEqualTo(2L);
        assertThat(dto.rewardedCount()).isEqualTo(1L);
        assertThat(dto.cap()).isEqualTo(10);
    }

    @Test
    void invite_usesTheDisplayNameOtherwiseTheUsernameAndHidesBannedInviters() {
        when(codeRepository.findByCode("ABCD2345")).thenReturn(Optional.of(codeOwnedBy(INVITER_ID)));

        assertThat(service.invite("abcd2345")).get().extracting("inviterName").isEqualTo("First Last");

        inviter.setName("  ");
        inviter.setUsername("flast");
        assertThat(service.invite("ABCD2345")).get().extracting("inviterName").isEqualTo("flast");

        inviter.setBanned(true);
        assertThat(service.invite("ABCD2345")).isEmpty();
        assertThat(service.invite("NOPE")).isEmpty();
    }

    private void assertStillPending() {
        verify(referralRepository, never()).claim(anyLong(), any());
        verify(referralRepository, never()).reject(anyLong(), anyString());
        verify(progressService, never()).grantChest(any(), any(), anyString(), any(), any());
        verify(dispatcher, never()).dispatch(any(), any(), any(), anyString(), anyString(), anyString(), anyString());
    }

    private static User user(Long id, String email, String name, boolean verified) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setUsername("user" + id);
        user.setName(name);
        user.setEmailVerified(verified);
        return user;
    }

    private static ReferralCode codeOwnedBy(Long userId) {
        ReferralCode code = new ReferralCode();
        code.setUserId(userId);
        code.setCode("ABCD2345");
        return code;
    }

    private static UserProgress progress(Long userId) {
        UserProgress progress = new UserProgress();
        progress.setUserId(userId);
        return progress;
    }
}
