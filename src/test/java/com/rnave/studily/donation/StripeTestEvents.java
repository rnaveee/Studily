package com.rnave.studily.donation;

import com.stripe.Stripe;
import com.stripe.model.Event;
import com.stripe.net.Webhook;

import java.util.UUID;

final class StripeTestEvents {

    static final String WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

    private StripeTestEvents() {
    }

    static String session(String eventId, String type, UUID donationId, String sessionId, String paymentStatus,
                          long amountTotal, String currency, String paymentIntent) {
        String object = "{\"id\":\"" + sessionId + "\",\"object\":\"checkout.session\""
                + ",\"client_reference_id\":" + (donationId == null ? "null" : "\"" + donationId + "\"")
                + ",\"payment_status\":\"" + paymentStatus + "\""
                + ",\"amount_total\":" + amountTotal
                + ",\"currency\":\"" + currency + "\""
                + ",\"payment_intent\":" + (paymentIntent == null ? "null" : "\"" + paymentIntent + "\"") + "}";
        return envelope(eventId, type, object);
    }

    static String charge(String eventId, String type, String paymentIntent, boolean refunded) {
        String object = "{\"id\":\"ch_1\",\"object\":\"charge\",\"refunded\":" + refunded
                + ",\"payment_intent\":\"" + paymentIntent + "\"}";
        return envelope(eventId, type, object);
    }

    static String dispute(String eventId, String paymentIntent) {
        String object = "{\"id\":\"dp_1\",\"object\":\"dispute\",\"payment_intent\":\"" + paymentIntent + "\"}";
        return envelope(eventId, "charge.dispute.created", object);
    }

    static String envelope(String eventId, String type, String object) {
        return "{\"id\":\"" + eventId + "\",\"object\":\"event\",\"api_version\":\"" + Stripe.API_VERSION
                + "\",\"type\":\"" + type + "\",\"data\":{\"object\":" + object + "}}";
    }

    static String createdAt(String json, long epochSecond) {
        return "{\"created\":" + epochSecond + "," + json.substring(1);
    }

    static Event parse(String json) {
        return Webhook.constructEventWithoutVerification(json);
    }

    static String signatureHeader(String payload, String secret, long timestamp) {
        try {
            String signed = Webhook.Util.computeHmacSha256(secret, timestamp + "." + payload);
            return "t=" + timestamp + ",v1=" + signed;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
