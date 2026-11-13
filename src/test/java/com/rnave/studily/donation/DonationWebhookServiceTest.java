package com.rnave.studily.donation;

import com.rnave.studily.notification.NotificationDispatcher;
import com.rnave.studily.notification.NotificationType;
import com.rnave.studily.support.SupporterBadge;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DonationWebhookServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-12T12:00:00Z");

    @Mock
    private DonationRepository donations;

    @Mock
    private StripeEventRepository events;

    @Mock
    private SupporterBadge supporterBadge;

    @Mock
    private UserRepository users;

    @Mock
    private NotificationDispatcher dispatcher;

    private User user;

    private DonationWebhookService service;
    private UUID donationId;
    private Donation donation;

    @BeforeEach
    void setUp() {
        service = new DonationWebhookService(donations, events, supporterBadge, users, dispatcher,
                Clock.fixed(NOW, ZoneOffset.UTC));
        user = new User();
        user.setId(7L);
        lenient().when(users.findById(7L)).thenReturn(Optional.of(user));
        donationId = UUID.randomUUID();
        donation = new Donation();
        donation.setId(donationId);
        donation.setUserId(7L);
        donation.setAmountCents(500);
        donation.setCurrency("cad");
        donation.setStatus(DonationStatus.PENDING);
        lenient().when(events.insertIfAbsent(anyString(), anyString())).thenReturn(1);
        lenient().when(donations.findById(donationId)).thenReturn(Optional.of(donation));
    }

    private Event completed(String eventId, String status, long amount, String currency) {
        return StripeTestEvents.parse(StripeTestEvents.session(eventId, "checkout.session.completed",
                donationId, "cs_1", status, amount, currency, "pi_1"));
    }

    @Test
    void paidCompletionMarksPaidAndGrantsBadgeOnce() {
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verify(donations).markPaid(donationId, NOW, "pi_1");
        verify(supporterBadge).grantIfMissing(7L, null);
    }

    @Test
    void lostClaimDoesNotGrant() {
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(0);

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verifyNoInteractions(supporterBadge);
    }

    @Test
    void replayedEventIsANoOp() {
        when(events.insertIfAbsent("evt_1", "checkout.session.completed")).thenReturn(0);

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verifyNoInteractions(donations);
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void unpaidCompletionDoesNothing() {
        service.handle(completed("evt_1", "unpaid", 500, "cad"));

        verify(donations, never()).markPaid(any(), any(), any());
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void asyncPaymentSucceededGrants() {
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);
        Event event = StripeTestEvents.parse(StripeTestEvents.session("evt_2",
                "checkout.session.async_payment_succeeded", donationId, "cs_1", "paid", 500, "cad", "pi_1"));

        service.handle(event);

        verify(supporterBadge).grantIfMissing(7L, null);
    }

    @Test
    void amountMismatchDoesNotGrant() {
        service.handle(completed("evt_1", "paid", 200, "cad"));

        verify(donations, never()).markPaid(any(), any(), any());
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void currencyMismatchDoesNotGrant() {
        service.handle(completed("evt_1", "paid", 500, "usd"));

        verify(donations, never()).markPaid(any(), any(), any());
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void fallsBackToSessionIdWhenReferenceIsMissing() {
        when(donations.findByStripeSessionId("cs_9")).thenReturn(Optional.of(donation));
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);
        Event event = StripeTestEvents.parse(StripeTestEvents.session("evt_3", "checkout.session.completed",
                null, "cs_9", "paid", 500, "cad", "pi_1"));

        service.handle(event);

        verify(supporterBadge).grantIfMissing(7L, null);
    }

    @Test
    void deletedAccountStillRecordsPaymentWithoutBadge() {
        donation.setUserId(null);
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verify(donations).markPaid(donationId, NOW, "pi_1");
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void expiredMarksPendingExpired() {
        Event event = StripeTestEvents.parse(StripeTestEvents.session("evt_4", "checkout.session.expired",
                donationId, "cs_1", "unpaid", 500, "cad", null));

        service.handle(event);

        verify(donations).markExpired(donationId);
    }

    @Test
    void asyncPaymentFailedMarksExpired() {
        Event event = StripeTestEvents.parse(StripeTestEvents.session("evt_5",
                "checkout.session.async_payment_failed", donationId, "cs_1", "unpaid", 500, "cad", null));

        service.handle(event);

        verify(donations).markExpired(donationId);
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void fullRefundMarksRefunded() {
        when(donations.existsByStripePaymentIntent("pi_1")).thenReturn(true);

        service.handle(StripeTestEvents.parse(StripeTestEvents.charge("evt_6", "charge.refunded", "pi_1", true)));

        verify(donations).markRefunded("pi_1");
    }

    @Test
    void partialRefundIsIgnored() {
        service.handle(StripeTestEvents.parse(StripeTestEvents.charge("evt_6", "charge.refunded", "pi_1", false)));

        verify(donations, never()).markRefunded(anyString());
    }

    @Test
    void disputeMarksDisputed() {
        when(donations.existsByStripePaymentIntent("pi_1")).thenReturn(true);

        service.handle(StripeTestEvents.parse(StripeTestEvents.dispute("evt_7", "pi_1")));

        verify(donations).markDisputed(eq("pi_1"));
    }

    @Test
    void unknownEventTypeIsIgnored() {
        service.handle(StripeTestEvents.parse(StripeTestEvents.envelope("evt_8", "customer.created",
                "{\"id\":\"cus_1\",\"object\":\"customer\"}")));

        verifyNoInteractions(donations);
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void unreadablePayloadThrowsSoStripeRetries() {
        Event event = StripeTestEvents.parse(StripeTestEvents.envelope("evt_9", "charge.refunded",
                "{\"id\":\"cs_1\",\"object\":\"checkout.session\"}"));

        assertThatThrownBy(() -> service.handle(event)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void grantSendsTheThanksNotification() {
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verify(dispatcher).dispatch(user, NotificationType.DONATION_THANKS, null, "DONATION:" + donationId,
                "Thank you for supporting Studily!", "Your Supporter badge is on your profile.", "/support-studily");
    }

    @Test
    void lostClaimSendsNoNotification() {
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(0);

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verifyNoInteractions(dispatcher);
    }

    @Test
    void notificationFailureDoesNotFailTheWebhook() {
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);
        doThrow(new IllegalStateException("push down")).when(dispatcher)
                .dispatch(any(), any(), any(), anyString(), anyString(), anyString(), anyString());

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verify(supporterBadge).grantIfMissing(7L, null);
    }

    @Test
    void userDeletedBetweenRowAndGrantRecordsPaymentOnly() {
        when(users.findById(7L)).thenReturn(Optional.empty());
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verify(donations).markPaid(donationId, NOW, "pi_1");
        verifyNoInteractions(supporterBadge);
        verifyNoInteractions(dispatcher);
    }

    @Test
    void sessionThatIsNotTheRowsSessionDoesNotGrant() {
        donation.setStripeSessionId("cs_real");

        service.handle(completed("evt_1", "paid", 500, "cad"));

        verify(donations, never()).markPaid(any(), any(), any());
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void metadataUserIdIsNeverUsedToCredit() {
        String object = "{\"id\":\"cs_1\",\"object\":\"checkout.session\",\"client_reference_id\":\"" + donationId
                + "\",\"payment_status\":\"paid\",\"amount_total\":500,\"currency\":\"cad\","
                + "\"payment_intent\":\"pi_1\",\"metadata\":{\"userId\":\"999\",\"donationId\":\"x\"}}";
        when(donations.markPaid(donationId, NOW, "pi_1")).thenReturn(1);

        service.handle(StripeTestEvents.parse(StripeTestEvents.envelope("evt_m", "checkout.session.completed", object)));

        verify(supporterBadge).grantIfMissing(7L, null);
        verify(users, never()).findById(999L);
    }

    @Test
    void missingAmountTotalDoesNotGrant() {
        String object = "{\"id\":\"cs_1\",\"object\":\"checkout.session\",\"client_reference_id\":\"" + donationId
                + "\",\"payment_status\":\"paid\",\"currency\":\"cad\",\"payment_intent\":\"pi_1\"}";

        service.handle(StripeTestEvents.parse(StripeTestEvents.envelope("evt_n", "checkout.session.completed", object)));

        verify(donations, never()).markPaid(any(), any(), any());
        verifyNoInteractions(supporterBadge);
    }

    @Test
    void refundArrivingBeforeThePaymentIsRetried() {
        Event refund = StripeTestEvents.parse(StripeTestEvents.createdAt(
                StripeTestEvents.charge("evt_r", "charge.refunded", "pi_new", true), NOW.getEpochSecond() - 60));

        assertThatThrownBy(() -> service.handle(refund)).isInstanceOf(IllegalStateException.class);
        verify(donations, never()).markRefunded(anyString());
    }

    @Test
    void disputeArrivingBeforeThePaymentIsRetried() {
        Event dispute = StripeTestEvents.parse(StripeTestEvents.createdAt(
                StripeTestEvents.dispute("evt_d", "pi_new"), NOW.getEpochSecond() - 60));

        assertThatThrownBy(() -> service.handle(dispute)).isInstanceOf(IllegalStateException.class);
        verify(donations, never()).markDisputed(anyString());
    }

    @Test
    void oldRefundForAnUnknownPaymentIsIgnored() {
        Event refund = StripeTestEvents.parse(StripeTestEvents.createdAt(
                StripeTestEvents.charge("evt_r", "charge.refunded", "pi_other", true), NOW.getEpochSecond() - 7200));

        service.handle(refund);

        verifyNoInteractions(supporterBadge);
    }
}
