package com.rnave.studily.canvas;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedUrlCipherTest {

    static String keyOf(int fill) {
        byte[] bytes = new byte[32];
        Arrays.fill(bytes, (byte) fill);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static final String URL = "https://school.instructure.com/feeds/calendars/user_secret.ics";

    @Test
    void roundTripsAUrl() {
        FeedUrlCipher cipher = new FeedUrlCipher(keyOf(1));

        String stored = cipher.encrypt(URL);

        assertThat(stored).startsWith("v1:").doesNotContain("instructure");
        assertThat(cipher.decrypt(stored)).isEqualTo(URL);
    }

    @Test
    void usesAFreshIvEveryTime() {
        FeedUrlCipher cipher = new FeedUrlCipher(keyOf(1));

        assertThat(cipher.encrypt(URL)).isNotEqualTo(cipher.encrypt(URL));
    }

    @Test
    void detectsTampering() {
        FeedUrlCipher cipher = new FeedUrlCipher(keyOf(1));
        byte[] raw = Base64.getDecoder().decode(cipher.encrypt(URL).substring(3));
        raw[raw.length - 1] ^= 1;
        String tampered = "v1:" + Base64.getEncoder().encodeToString(raw);

        assertThatThrownBy(() -> cipher.decrypt(tampered)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void failsWithTheWrongKey() {
        String stored = new FeedUrlCipher(keyOf(1)).encrypt(URL);

        assertThatThrownBy(() -> new FeedUrlCipher(keyOf(2)).decrypt(stored))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aMissingKeyDisablesIt() {
        FeedUrlCipher cipher = new FeedUrlCipher("");

        assertThat(cipher.isEnabled()).isFalse();
        assertThatThrownBy(() -> cipher.encrypt(URL)).isInstanceOf(IllegalStateException.class);
        assertThat(new FeedUrlCipher(null).isEnabled()).isFalse();
    }

    @Test
    void aBadKeyLengthFailsFast() {
        String shortKey = Base64.getEncoder().encodeToString(new byte[16]);

        assertThatThrownBy(() -> new FeedUrlCipher(shortKey))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
        assertThatThrownBy(() -> new FeedUrlCipher("not base64 !!"))
                .isInstanceOf(IllegalStateException.class);
    }
}
