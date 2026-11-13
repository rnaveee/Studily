package com.rnave.studily.donation;

import com.stripe.StripeClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class StripeSettings {

    private final String webhookSecret;
    private final StripeClient client;

    public StripeSettings(@Value("${app.stripe.secret-key:}") String secretKey,
                          @Value("${app.stripe.webhook-secret:}") String webhookSecret) {
        String secret = secretKey == null ? "" : secretKey.trim();
        String hook = webhookSecret == null ? "" : webhookSecret.trim();
        if (!secret.isEmpty() && !secret.startsWith("sk_") && !secret.startsWith("rk_")) {
            throw new IllegalStateException("STRIPE_SECRET_KEY must start with sk_ or rk_");
        }
        if (!hook.isEmpty() && !hook.startsWith("whsec_")) {
            throw new IllegalStateException("STRIPE_WEBHOOK_SECRET must start with whsec_");
        }
        if (secret.isEmpty() || hook.isEmpty()) {
            this.webhookSecret = null;
            this.client = null;
            return;
        }
        this.webhookSecret = hook;
        this.client = new StripeClient(secret);
    }

    public boolean isEnabled() {
        return client != null;
    }

    public StripeClient client() {
        return client;
    }

    public String webhookSecret() {
        return webhookSecret;
    }
}
