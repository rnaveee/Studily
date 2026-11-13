package com.rnave.studily.donation;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stripe")
public class StripeWebhookController {

    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final StripeSettings stripeSettings;
    private final DonationWebhookService webhookService;

    public StripeWebhookController(StripeSettings stripeSettings, DonationWebhookService webhookService) {
        this.stripeSettings = stripeSettings;
        this.webhookService = webhookService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> receive(@RequestBody String payload,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        if (!stripeSettings.isEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (signature == null || signature.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signature, stripeSettings.webhookSecret());
        } catch (SignatureVerificationException e) {
            log.warn("Rejected Stripe webhook with an invalid signature");
            return ResponseEntity.badRequest().build();
        } catch (RuntimeException e) {
            log.warn("Rejected malformed Stripe webhook payload");
            return ResponseEntity.badRequest().build();
        }
        webhookService.handle(event);
        return ResponseEntity.ok().build();
    }
}
