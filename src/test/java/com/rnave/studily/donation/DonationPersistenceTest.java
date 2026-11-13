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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.rnave.studily.donation.DonationDtos.CheckoutResponse;
import com.stripe.StripeClient;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import org.mockito.Answers;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

    @Autowired
    private PlatformTransactionManager transactionManager;

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
        jdbc.update("DELETE FROM notifications WHERE user_id = ?", user.getId());
        jdbc.update("DELETE FROM donations WHERE user_id = ?", user.getId());
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

    private int thanksCount() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM notifications WHERE user_id = ? AND dedup_key = ?",
                Integer.class, user.getId(), "DONATION:" + donation.getId());
    }

    private DonationStatus status() {
        return donationRepository.findById(donation.getId()).orElseThrow().getStatus();
    }

    private <T> List<T> race(Callable<T> first, Callable<T> second) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (Callable<T> task : List.of(first, second)) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return task.call();
                }));
            }
            ready.await();
            go.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> f : futures) {
                results.add(f.get());
            }
            return results;
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
        assertThat(thanksCount()).isEqualTo(1);
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
        assertThat(thanksCount()).isEqualTo(1);
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

    @Test
    void paymentReportedAfterExpiryIsStillRecordedAndGranted() {
        Event expired = StripeTestEvents.parse(StripeTestEvents.session("evt_exp_" + UUID.randomUUID(),
                "checkout.session.expired", donation.getId(), donation.getStripeSessionId(), "unpaid",
                500, "cad", null));
        eventIds.add(expired.getId());

        webhookService.handle(expired);
        assertThat(status()).isEqualTo(DonationStatus.EXPIRED);
        webhookService.handle(completed("checkout.session.completed"));

        assertThat(status()).isEqualTo(DonationStatus.PAID);
        assertThat(badgeCount()).isEqualTo(1);
    }

    @Test
    void refundBeforeCompletionIsRetriedAndThenApplied() {
        String pi = "pi_" + donation.getId();
        String refundJson = StripeTestEvents.createdAt(StripeTestEvents.charge("evt_ref_" + UUID.randomUUID(),
                "charge.refunded", pi, true), Instant.now().getEpochSecond());
        Event refund = StripeTestEvents.parse(refundJson);
        eventIds.add(refund.getId());

        assertThatThrownBy(() -> webhookService.handle(refund)).isInstanceOf(IllegalStateException.class);
        assertThat(eventCount(refund.getId())).isZero();

        webhookService.handle(completed("checkout.session.completed"));
        webhookService.handle(StripeTestEvents.parse(refundJson));

        assertThat(status()).isEqualTo(DonationStatus.REFUNDED);
        assertThat(eventCount(refund.getId())).isEqualTo(1);
    }

    @Test
    void concurrentCheckoutsForTheSameUserCreateOneSession() throws Exception {
        StripeSettings settings = mock(StripeSettings.class);
        StripeClient client = mock(StripeClient.class, Answers.RETURNS_DEEP_STUBS);
        AtomicInteger created = new AtomicInteger();
        when(settings.isEnabled()).thenReturn(true);
        when(settings.client()).thenReturn(client);
        when(client.checkout().sessions().create(any(SessionCreateParams.class), any(RequestOptions.class)))
                .thenAnswer(invocation -> {
                    int n = created.incrementAndGet();
                    Thread.sleep(300);
                    Session session = new Session();
                    session.setId("cs_race_" + n + "_" + UUID.randomUUID());
                    session.setUrl("https://checkout.stripe.com/c/pay/race_" + n);
                    return session;
                });
        DonationService service = new DonationService(donationRepository, settings, new DonationCheckoutRateLimiter(),
                jdbc, Clock.systemUTC(), "https://studily.ca");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Callable<CheckoutResponse> attempt = () -> tx.execute(s -> service.checkout(user.getId(), "a@b.c", 1000));

        List<CheckoutResponse> responses = race(attempt, attempt);

        assertThat(created.get()).isEqualTo(1);
        assertThat(responses.get(0).url()).isEqualTo(responses.get(1).url());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM donations WHERE user_id = ? AND amount_cents = 1000",
                Integer.class, user.getId())).isEqualTo(1);
    }
}
