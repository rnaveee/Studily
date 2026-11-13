package com.rnave.studily.donation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StripeSettingsTest {

    @Test
    void blankKeysDisableTheFeature() {
        assertThat(new StripeSettings("", "").isEnabled()).isFalse();
        assertThat(new StripeSettings(null, null).isEnabled()).isFalse();
    }

    @Test
    void oneMissingKeyDisablesTheFeature() {
        assertThat(new StripeSettings("sk_test_abc", "").isEnabled()).isFalse();
        assertThat(new StripeSettings("", "whsec_abc").isEnabled()).isFalse();
    }

    @Test
    void bothWellFormedKeysEnableIt() {
        StripeSettings settings = new StripeSettings("sk_test_abc", "whsec_abc");
        assertThat(settings.isEnabled()).isTrue();
        assertThat(settings.client()).isNotNull();
        assertThat(settings.webhookSecret()).isEqualTo("whsec_abc");
    }

    @Test
    void restrictedKeysAreAccepted() {
        assertThat(new StripeSettings("rk_live_abc", "whsec_abc").isEnabled()).isTrue();
    }

    @Test
    void malformedSecretKeyFailsStartupWithoutEchoingIt() {
        assertThatThrownBy(() -> new StripeSettings("pk_live_publishable", "whsec_abc"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("pk_live_publishable");
    }

    @Test
    void malformedWebhookSecretFailsStartupEvenWhenSecretKeyIsBlank() {
        assertThatThrownBy(() -> new StripeSettings("", "not-a-webhook-secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("not-a-webhook-secret");
    }
}
