package com.rnave.studily.donation;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.ServiceUnavailableException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.donation.DonationDtos.CheckoutResponse;
import com.rnave.studily.donation.DonationDtos.ConfigResponse;
import com.rnave.studily.donation.DonationDtos.StatusResponse;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class DonationService {

    private static final Logger log = LoggerFactory.getLogger(DonationService.class);

    static final int MIN_CENTS = 200;
    static final int MAX_CENTS = 100_000;
    static final String CURRENCY = "cad";
    static final List<Integer> PRESETS = List.of(200, 500, 1000, 2000);
    static final Duration REUSE_WINDOW = Duration.ofMinutes(30);

    private final DonationRepository donationRepository;
    private final StripeSettings stripeSettings;
    private final DonationCheckoutRateLimiter rateLimiter;
    private final Clock clock;
    private final String baseUrl;

    public DonationService(DonationRepository donationRepository, StripeSettings stripeSettings,
                           DonationCheckoutRateLimiter rateLimiter, Clock clock,
                           @Value("${app.base-url}") String baseUrl) {
        this.donationRepository = donationRepository;
        this.stripeSettings = stripeSettings;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.baseUrl = baseUrl.trim().replaceAll("/+$", "");
    }

    public ConfigResponse config() {
        return new ConfigResponse(stripeSettings.isEnabled(), CURRENCY, PRESETS, MIN_CENTS, MAX_CENTS);
    }

    public CheckoutResponse checkout(Long userId, String email, Number amount) {
        if (!stripeSettings.isEnabled()) {
            throw new ServiceUnavailableException("Donations are not available right now");
        }
        int amountCents = validAmount(amount);
        if (!rateLimiter.tryConsume(userId)) {
            throw new TooManyRequestsException("Too many checkout attempts, please try again in a few minutes");
        }

        Instant now = clock.instant();
        var open = donationRepository.findOpenCheckout(userId, amountCents, now.minus(REUSE_WINDOW));
        if (open.isPresent()) {
            return new CheckoutResponse(open.get().getCheckoutUrl());
        }

        Donation donation = new Donation();
        donation.setId(UUID.randomUUID());
        donation.setUserId(userId);
        donation.setAmountCents(amountCents);
        donation.setCurrency(CURRENCY);
        donation.setStatus(DonationStatus.PENDING);
        donation.setCreatedAt(now);
        donationRepository.save(donation);

        Session session;
        try {
            session = stripeSettings.client().checkout().sessions().create(
                    sessionParams(donation, email),
                    RequestOptions.builder().setIdempotencyKey(donation.getId().toString()).build());
        } catch (StripeException e) {
            log.warn("Stripe checkout session creation failed: {} status={} code={}",
                    e.getClass().getSimpleName(), e.getStatusCode(), e.getCode());
            donationRepository.markExpired(donation.getId());
            throw new PaymentProviderException("We couldn't start the checkout. Please try again in a moment.");
        }

        donation.setStripeSessionId(session.getId());
        donation.setCheckoutUrl(session.getUrl());
        donationRepository.save(donation);
        return new CheckoutResponse(session.getUrl());
    }

    public StatusResponse status(Long userId, UUID id) {
        Donation donation = donationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Donation not found"));
        return new StatusResponse(donation.getStatus(), donation.getAmountCents());
    }

    static int validAmount(Number amount) {
        if (!(amount instanceof Integer) && !(amount instanceof Long)) {
            throw new BadRequestException("Amount must be a whole number of cents");
        }
        long value = amount.longValue();
        if (value < MIN_CENTS || value > MAX_CENTS) {
            throw new BadRequestException("Amount must be between $2 and $1,000");
        }
        return (int) value;
    }

    private SessionCreateParams sessionParams(Donation donation, String email) {
        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSubmitType(SessionCreateParams.SubmitType.DONATE)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(CURRENCY)
                                .setUnitAmount((long) donation.getAmountCents())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("Support Studily")
                                        .build())
                                .build())
                        .build())
                .setClientReferenceId(donation.getId().toString())
                .putMetadata("donationId", donation.getId().toString())
                .putMetadata("userId", String.valueOf(donation.getUserId()))
                .setSuccessUrl(baseUrl + "/support-studily?donation=success&id=" + donation.getId())
                .setCancelUrl(baseUrl + "/support-studily?donation=cancelled");
        if (email != null && !email.isBlank()) {
            builder.setCustomerEmail(email);
        }
        return builder.build();
    }
}
