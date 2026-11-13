package com.rnave.studily.referral;

import com.rnave.studily.moderation.BannedEmails;
import com.rnave.studily.notification.NotificationDispatcher;
import com.rnave.studily.notification.NotificationType;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ChestTier;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.XpEventRepository;
import com.rnave.studily.progress.XpSource;
import com.rnave.studily.referral.ReferralDtos.InviteDto;
import com.rnave.studily.referral.ReferralDtos.ReferralSummaryDto;
import com.rnave.studily.support.SupporterBadge;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

@Service
public class ReferralService {

    public static final int CAP = 10;
    static final Duration MAX_INVITEE_AGE = Duration.ofDays(30);
    static final String REASON_EXPIRED = "expired";
    static final String REASON_CAP = "cap";
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final int CODE_ATTEMPTS = 8;

    private static final Logger log = LoggerFactory.getLogger(ReferralService.class);

    private final ReferralRepository referralRepository;
    private final ReferralCodeRepository codeRepository;
    private final UserRepository userRepository;
    private final XpEventRepository xpEventRepository;
    private final ProgressService progressService;
    private final SupporterBadge supporterBadge;
    private final NotificationDispatcher notificationDispatcher;
    private final Clock clock;
    private final TransactionTemplate isolated;
    private final String baseUrl;
    private final SecureRandom random = new SecureRandom();

    public ReferralService(ReferralRepository referralRepository, ReferralCodeRepository codeRepository,
                           UserRepository userRepository, XpEventRepository xpEventRepository,
                           ProgressService progressService, SupporterBadge supporterBadge,
                           NotificationDispatcher notificationDispatcher, Clock clock,
                           PlatformTransactionManager transactionManager,
                           @Value("${app.base-url}") String baseUrl) {
        this.referralRepository = referralRepository;
        this.codeRepository = codeRepository;
        this.userRepository = userRepository;
        this.xpEventRepository = xpEventRepository;
        this.progressService = progressService;
        this.supporterBadge = supporterBadge;
        this.notificationDispatcher = notificationDispatcher;
        this.clock = clock;
        this.isolated = new TransactionTemplate(transactionManager);
        this.isolated.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    @Transactional
    public String codeFor(Long userId) {
        for (int attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
            Optional<ReferralCode> existing = codeRepository.findById(userId);
            if (existing.isPresent()) {
                return existing.get().getCode();
            }
            codeRepository.insertIfAbsent(userId, randomCode());
        }
        return codeRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Could not allocate a referral code"))
                .getCode();
    }

    @Transactional
    public ReferralSummaryDto me(Long userId) {
        String code = codeFor(userId);
        return new ReferralSummaryDto(code, baseUrl + "/invite/" + code,
                referralRepository.countByInviterId(userId),
                referralRepository.countByInviterIdAndStatus(userId, ReferralStatus.PENDING),
                referralRepository.countByInviterIdAndStatus(userId, ReferralStatus.REWARDED),
                CAP);
    }

    @Transactional(readOnly = true)
    public Optional<InviteDto> invite(String rawCode) {
        return inviterOf(rawCode)
                .filter(inviter -> !inviter.isBanned())
                .map(inviter -> new InviteDto(displayName(inviter)));
    }

    public void recordSignup(User invitee, String rawCode) {
        Optional<User> found = inviterOf(rawCode);
        if (found.isEmpty()) {
            return;
        }
        User inviter = found.get();
        Instant now = clock.instant();
        if (inviter.getId().equals(invitee.getId()) || inviter.isSuspendedAt(now)) {
            return;
        }
        if (BannedEmails.normalize(inviter.getEmail()).equals(BannedEmails.normalize(invitee.getEmail()))) {
            return;
        }
        referralRepository.insertPending(inviter.getId(), invitee.getId(), now);
    }

    public void onEmailVerified(Long inviteeId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    evaluateForInvitee(inviteeId);
                }
            });
        } else {
            evaluateForInvitee(inviteeId);
        }
    }

    public void evaluate(Long referralId) {
        Payout payout = isolated.execute(status -> decide(referralId));
        if (payout != null) {
            notifyPayout(payout);
        }
    }

    private void evaluateForInvitee(Long inviteeId) {
        try {
            Long referralId = isolated.execute(status -> referralRepository.findByInviteeId(inviteeId)
                    .filter(r -> r.getStatus() == ReferralStatus.PENDING)
                    .map(Referral::getId)
                    .orElse(null));
            if (referralId != null) {
                evaluate(referralId);
            }
        } catch (RuntimeException e) {
            log.debug("Referral check after email verification failed for user {}", inviteeId, e);
        }
    }

    private Payout decide(Long referralId) {
        Referral referral = referralRepository.findById(referralId).orElse(null);
        if (referral == null || referral.getStatus() != ReferralStatus.PENDING) {
            return null;
        }
        Instant now = clock.instant();
        User invitee = userRepository.findById(referral.getInviteeId()).orElse(null);
        User inviter = userRepository.findById(referral.getInviterId()).orElse(null);
        if (invitee == null || inviter == null) {
            return null;
        }
        if (invitee.getCreatedAt() != null && invitee.getCreatedAt().plus(MAX_INVITEE_AGE).isBefore(now)) {
            referralRepository.reject(referralId, REASON_EXPIRED);
            return null;
        }
        if (!invitee.isEmailVerified()
                || !xpEventRepository.existsByUserIdAndSourceNot(invitee.getId(), XpSource.FRIEND)) {
            return null;
        }
        if (!inviter.isEmailVerified() || inviter.isSuspendedAt(now)) {
            return null;
        }

        boolean inviterFirst = inviter.getId() < invitee.getId();
        ProgressDeltaBuilder first = progressService.begin(inviterFirst ? inviter.getId() : invitee.getId());
        ProgressDeltaBuilder second = progressService.begin(inviterFirst ? invitee.getId() : inviter.getId());
        ProgressDeltaBuilder inviterDelta = inviterFirst ? first : second;
        ProgressDeltaBuilder inviteeDelta = inviterFirst ? second : first;

        if (referralRepository.countByInviterIdAndStatus(inviter.getId(), ReferralStatus.REWARDED) >= CAP) {
            referralRepository.reject(referralId, REASON_CAP);
            return null;
        }
        if (referralRepository.claim(referralId, now) != 1) {
            return null;
        }

        progressService.grantChest(inviterDelta, ChestSource.REFERRAL, "referral:" + invitee.getId(), null, ChestTier.GOLD);
        supporterBadge.grantIfMissing(inviter.getId(), inviterDelta);
        progressService.finish(inviterDelta);

        progressService.grantChest(inviteeDelta, ChestSource.REFERRAL, "referred", null, ChestTier.GOLD);
        progressService.finish(inviteeDelta);
        return new Payout(referralId, inviter, invitee);
    }

    private void notifyPayout(Payout payout) {
        send(payout.inviter(), "REFERRAL:" + payout.referralId() + ":inviter",
                displayName(payout.invitee()) + " joined through your invite",
                "You earned a gold chest. Thanks for spreading the word.");
        send(payout.invitee(), "REFERRAL:" + payout.referralId() + ":invitee",
                "You got a gold chest",
                "Thanks for joining through " + displayName(payout.inviter()) + "'s invite. Open it from your chests.");
    }

    private void send(User user, String dedupKey, String title, String body) {
        try {
            notificationDispatcher.dispatch(user, NotificationType.REFERRAL_REWARD, null, dedupKey, title, body,
                    "/support-studily");
        } catch (RuntimeException e) {
            log.error("Could not send referral notification {} to user {}", dedupKey, user.getId(), e);
        }
    }

    private Optional<User> inviterOf(String rawCode) {
        if (rawCode == null || rawCode.isBlank()) {
            return Optional.empty();
        }
        String code = rawCode.trim().toUpperCase(Locale.ROOT);
        return codeRepository.findByCode(code).flatMap(owner -> userRepository.findById(owner.getUserId()));
    }

    static String displayName(User user) {
        return user.getName() == null || user.getName().isBlank() ? user.getUsername() : user.getName().trim();
    }

    private String randomCode() {
        StringBuilder out = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            out.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return out.toString();
    }

    private record Payout(Long referralId, User inviter, User invitee) {
    }
}
