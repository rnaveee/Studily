package com.rnave.studily.referral;

import com.rnave.studily.progress.XpEvent;
import com.rnave.studily.progress.XpEventRepository;
import com.rnave.studily.progress.XpSource;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ReferralPersistenceTest {

    @Autowired
    private ReferralService referralService;

    @Autowired
    private ReferralRepository referralRepository;

    @Autowired
    private ReferralCodeRepository codeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private XpEventRepository xpEventRepository;

    @Autowired
    private JdbcTemplate jdbc;

    private User inviter;
    private User invitee;
    private User other;

    @AfterEach
    void cleanUp() {
        for (User user : new User[]{inviter, invitee, other}) {
            if (user != null && user.getId() != null) {
                userRepository.deleteById(user.getId());
            }
        }
    }

    @Test
    void twoConcurrentEvaluationsPayOutExactlyOnce() throws Exception {
        inviter = newUser("inviter", true);
        invitee = newUser("invitee", true);
        xpEventRepository.save(xpEvent(invitee));
        assertThat(referralRepository.insertPending(inviter.getId(), invitee.getId(), Instant.now())).isEqualTo(1);
        Long referralId = referralRepository.findByInviteeId(invitee.getId()).orElseThrow().getId();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<?>> runs = List.of(
                    pool.submit(() -> race(start, referralId)),
                    pool.submit(() -> race(start, referralId)));
            start.countDown();
            for (Future<?> run : runs) {
                run.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(chests(inviter, "referral:" + invitee.getId())).isEqualTo(1);
        assertThat(chests(invitee, "referred")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from chests where source = 'REFERRAL' and tier = 'GOLD' and user_id in (?, ?)",
                Integer.class, inviter.getId(), invitee.getId())).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from user_badges where user_id = ? and badge_code = 'supporter'",
                Integer.class, inviter.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from user_badges where user_id = ? and badge_code = 'supporter'",
                Integer.class, invitee.getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from notifications where type = 'REFERRAL_REWARD' and user_id in (?, ?)",
                Integer.class, inviter.getId(), invitee.getId())).isEqualTo(2);
        Referral done = referralRepository.findById(referralId).orElseThrow();
        assertThat(done.getStatus()).isEqualTo(ReferralStatus.REWARDED);
        assertThat(done.getRewardedAt()).isNotNull();

        referralService.evaluate(referralId);
        assertThat(jdbc.queryForObject("select count(*) from chests where source = 'REFERRAL' and user_id in (?, ?)",
                Integer.class, inviter.getId(), invitee.getId())).isEqualTo(2);
    }

    @Test
    void anInviteeCanOnlyBeReferredOnce() {
        inviter = newUser("inviter", true);
        other = newUser("other", true);
        invitee = newUser("invitee", false);

        assertThat(referralRepository.insertPending(inviter.getId(), invitee.getId(), Instant.now())).isEqualTo(1);
        assertThat(referralRepository.insertPending(other.getId(), invitee.getId(), Instant.now())).isZero();
        assertThat(referralRepository.countByInviterId(other.getId())).isZero();

        Referral duplicate = new Referral();
        duplicate.setInviterId(other.getId());
        duplicate.setInviteeId(invitee.getId());
        assertThatThrownBy(() -> referralRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void referralCodesAreStablePerUserAndResolveBackToTheOwner() {
        inviter = newUser("inviter", true);

        String first = referralService.codeFor(inviter.getId());
        String second = referralService.codeFor(inviter.getId());

        assertThat(first).hasSize(8).isEqualTo(second);
        assertThat(codeRepository.findByCode(first).orElseThrow().getUserId()).isEqualTo(inviter.getId());
        assertThat(referralService.invite(first.toLowerCase())).isPresent();
    }

    @Test
    void signupHookCreatesOnePendingRowAndNeverForSelfInvites() {
        inviter = newUser("inviter", true);
        invitee = newUser("invitee", false);
        String code = referralService.codeFor(inviter.getId());

        referralService.recordSignup(invitee, code);
        referralService.recordSignup(invitee, code);

        assertThat(referralRepository.countByInviterIdAndStatus(inviter.getId(), ReferralStatus.PENDING)).isEqualTo(1);

        referralService.recordSignup(inviter, code);
        assertThat(referralRepository.findByInviteeId(inviter.getId())).isEmpty();
    }

    private void race(CountDownLatch start, Long referralId) {
        try {
            start.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }
        referralService.evaluate(referralId);
    }

    private int chests(User user, String ref) {
        return jdbc.queryForObject("select count(*) from chests where user_id = ? and source = 'REFERRAL' and source_ref = ?",
                Integer.class, user.getId(), ref);
    }

    private XpEvent xpEvent(User user) {
        XpEvent event = new XpEvent();
        event.setUser(user);
        event.setSource(XpSource.STUDY_BLOCK);
        event.setAmount(10);
        event.setDedupeKey("ref-test:" + UUID.randomUUID());
        event.setCreatedAt(Instant.now());
        return event;
    }

    private User newUser(String prefix, boolean verified) {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setEmail(prefix + "-" + tag + "@example.test");
        user.setUsername(prefix + tag);
        user.setName(prefix + " " + tag);
        user.setPasswordHash("x");
        user.setEmailVerified(verified);
        return userRepository.save(user);
    }
}
