package com.rnave.studily.donation;

import com.rnave.studily.support.SupporterBadge;
import com.stripe.exception.EventDataObjectDeserializationException;
import com.stripe.model.Charge;
import com.stripe.model.Dispute;
import com.stripe.model.Event;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Optional;
import java.util.UUID;

@Service
public class DonationWebhookService {

    private static final Logger log = LoggerFactory.getLogger(DonationWebhookService.class);

    private final DonationRepository donationRepository;
    private final StripeEventRepository eventRepository;
    private final SupporterBadge supporterBadge;
    private final Clock clock;

    public DonationWebhookService(DonationRepository donationRepository, StripeEventRepository eventRepository,
                                  SupporterBadge supporterBadge, Clock clock) {
        this.donationRepository = donationRepository;
        this.eventRepository = eventRepository;
        this.supporterBadge = supporterBadge;
        this.clock = clock;
    }

    @Transactional
    public void handle(Event event) {
        if (eventRepository.insertIfAbsent(event.getId(), event.getType()) == 0) {
            return;
        }
        switch (event.getType()) {
            case "checkout.session.completed" -> {
                Session session = session(event);
                if ("paid".equals(session.getPaymentStatus())) {
                    completePayment(session);
                }
            }
            case "checkout.session.async_payment_succeeded" -> completePayment(session(event));
            case "checkout.session.async_payment_failed", "checkout.session.expired" ->
                    findDonation(session(event)).ifPresent(d -> donationRepository.markExpired(d.getId()));
            case "charge.refunded" -> {
                Charge charge = payload(event, Charge.class);
                if (Boolean.TRUE.equals(charge.getRefunded()) && charge.getPaymentIntent() != null) {
                    donationRepository.markRefunded(charge.getPaymentIntent());
                }
            }
            case "charge.dispute.created" -> {
                Dispute dispute = payload(event, Dispute.class);
                if (dispute.getPaymentIntent() != null) {
                    donationRepository.markDisputed(dispute.getPaymentIntent());
                }
            }
            default -> {
            }
        }
    }

    private void completePayment(Session session) {
        Optional<Donation> found = findDonation(session);
        if (found.isEmpty()) {
            log.warn("Stripe session {} matches no donation", session.getId());
            return;
        }
        Donation donation = found.get();
        boolean amountMatches = session.getAmountTotal() != null
                && session.getAmountTotal() == donation.getAmountCents();
        boolean currencyMatches = session.getCurrency() != null
                && DonationService.CURRENCY.equalsIgnoreCase(session.getCurrency());
        if (!amountMatches || !currencyMatches) {
            log.warn("Stripe session {} does not match donation {}: not granting", session.getId(), donation.getId());
            return;
        }
        int claimed = donationRepository.markPaid(donation.getId(), clock.instant(), session.getPaymentIntent());
        if (claimed == 1 && donation.getUserId() != null) {
            supporterBadge.grantIfMissing(donation.getUserId(), null);
        }
    }

    private Optional<Donation> findDonation(Session session) {
        String reference = session.getClientReferenceId();
        if (reference != null) {
            try {
                Optional<Donation> byId = donationRepository.findById(UUID.fromString(reference));
                if (byId.isPresent()) {
                    return byId;
                }
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (session.getId() == null) {
            return Optional.empty();
        }
        return donationRepository.findByStripeSessionId(session.getId());
    }

    private Session session(Event event) {
        return payload(event, Session.class);
    }

    private <T extends StripeObject> T payload(Event event, Class<T> type) {
        var deserializer = event.getDataObjectDeserializer();
        Optional<StripeObject> object = deserializer.getObject();
        StripeObject resolved = object.orElse(null);
        if (resolved == null) {
            try {
                log.warn("Stripe event {} ({}) needed unsafe deserialization", event.getId(), event.getType());
                resolved = deserializer.deserializeUnsafe();
            } catch (EventDataObjectDeserializationException e) {
                throw new IllegalStateException("Could not read Stripe event " + event.getId());
            }
        }
        if (!type.isInstance(resolved)) {
            throw new IllegalStateException("Unexpected object in Stripe event " + event.getId());
        }
        return type.cast(resolved);
    }
}
