package com.rnave.studily.donation;

import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.stripe.model.Event;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DonationPersistenceTest {

    @Autowired
    private DonationWebhookService webhookService;

    @Autowired
    private DonationRepository donationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbc;

    private User user;
    private Donation donation;
    private final List<String> eventIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        user = new User();
        user.setEmail("don-" + tag + "@example.test");
        user.setUsername("don" + tag);
        user.setPasswordHash("x");
        user = userRepository.save(user);

        donation = new Donation();
        donation.setId(UUID.randomUUID());
        donation.setUserId(user.getId());
        donation.setAmountCents(500);
        donation.setCurrency("cad");
        donation.setStatus(DonationStatus.PENDING);
        donation.setCreatedAt(Instant.now());
        donation.setStripeSessionId("cs_" + tag);
        donation.setCheckoutUrl("https://checkout.stripe.com/c/pay/cs_" + tag);
        donationRepository.save(donation);
    }

    @AfterEach
    void cleanUp() {
        for (String id : eventIds) {
            jdbc.update("DELETE FROM stripe_events WHERE event_id = ?", id);
        }
        jdbc.update("DELETE FROM user_badges WHERE user_id = ?", user.getId());
        donationRepository.deleteById(donation.getId());
        userRepository.deleteById(user.getId());
    }

    private Event completed(String type) {
        String eventId = "evt_" + UUID.randomUUID();
        eventIds.add(eventId);
        return StripeTestEvents.parse(StripeTestEvents.session(eventId, type, donation.getId(),
                donation.getStripeSessionId(), "paid", 500, "cad", "pi_" + donation.getId()));
    }

    private Event withSameId(Event original) {
        return StripeTestEvents.parse(StripeTestEvents.session(original.getId(), original.getType(),
                donation.getId(), donation.getStripeSessionId(), "paid", 500, "cad", "pi_" + donation.getId()));
    }

    private int badgeCount() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM user_badges WHERE user_id = ? AND badge_code = 'supporter'",
                Integer.class, user.getId());
    }

    private int eventCount(String id) {
        return jdbc.queryForObject("SELECT count(*) FROM stripe_events WHERE event_id = ?", Integer.class, id);
    }

    private DonationStatus status() {
        return donationRepository.findById(donation.getId()).orElseThrow().getStatus();
    }

    private void race(Callable<?> first, Callable<?> second) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (Callable<?> task : List.of(first, second)) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return task.call();
                }));
            }
            ready.await();
            go.countDown();
            for (Future<?> f : futures) {
                f.get();
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void sameEventDeliveredConcurrentlyTransitionsToPaidExactlyOnce() throws Exception {
        Event event = completed("checkout.session.completed");

        race(() -> {
            webhookService.handle(event);
            return null;
        }, () -> {
            webhookService.handle(withSameId(event));
            return null;
        });

        assertThat(status()).isEqualTo(DonationStatus.PAID);
        assertThat(donationRepository.findById(donation.getId()).orElseThrow().getPaidAt()).isNotNull();
        assertThat(badgeCount()).isEqualTo(1);
        assertThat(eventCount(event.getId())).isEqualTo(1);
    }

    @Test
    void differentEventsForTheSamePaymentGrantOnce() throws Exception {
        Event completed = completed("checkout.session.completed");
        Event async = completed("checkout.session.async_payment_succeeded");

        race(() -> {
            webhookService.handle(completed);
            return null;
        }, () -> {
            webhookService.handle(async);
            return null;
        });

        assertThat(status()).isEqualTo(DonationStatus.PAID);
        assertThat(badgeCount()).isEqualTo(1);
        assertThat(eventCount(completed.getId())).isEqualTo(1);
        assertThat(eventCount(async.getId())).isEqualTo(1);
    }

    @Test
    void replayAfterCommitIsANoOp() {
        Event event = completed("checkout.session.completed");

        webhookService.handle(event);
        webhookService.handle(withSameId(event));

        assertThat(status()).isEqualTo(DonationStatus.PAID);
        assertThat(badgeCount()).isEqualTo(1);
    }

    @Test
    void expiredAfterPaidDoesNotDowngrade() {
        webhookService.handle(completed("checkout.session.completed"));
        Event expired = StripeTestEvents.parse(StripeTestEvents.session("evt_exp_" + UUID.randomUUID(),
                "checkout.session.expired", donation.getId(), donation.getStripeSessionId(), "unpaid",
                500, "cad", null));
        eventIds.add(expired.getId());

        webhookService.handle(expired);

        assertThat(status()).isEqualTo(DonationStatus.PAID);
    }

    @Test
    void refundThenLateDisputeKeepsRefunded() {
        webhookService.handle(completed("checkout.session.completed"));
        String pi = "pi_" + donation.getId();
        Event refund = StripeTestEvents.parse(StripeTestEvents.charge("evt_ref_" + UUID.randomUUID(),
                "charge.refunded", pi, true));
        Event dispute = StripeTestEvents.parse(StripeTestEvents.dispute("evt_dis_" + UUID.randomUUID(), pi));
        eventIds.add(refund.getId());
        eventIds.add(dispute.getId());

        webhookService.handle(refund);
        webhookService.handle(dispute);

        assertThat(status()).isEqualTo(DonationStatus.REFUNDED);
    }

    @Test
    void failedProcessingRollsBackTheEventRowSoStripeCanRetry() {
        String eventId = "evt_bad_" + UUID.randomUUID();
        eventIds.add(eventId);
        Event broken = StripeTestEvents.parse(StripeTestEvents.envelope(eventId, "charge.refunded",
                "{\"id\":\"cs_1\",\"object\":\"checkout.session\"}"));

        try {
            webhookService.handle(broken);
        } catch (IllegalStateException expected) {
        }

        assertThat(eventCount(eventId)).isZero();
    }
}
