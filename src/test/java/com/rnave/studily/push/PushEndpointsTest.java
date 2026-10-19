package com.rnave.studily.push;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PushEndpointsTest {

    @Test
    void acceptsKnownPushServices() {
        assertThat(PushEndpoints.isAllowed("https://fcm.googleapis.com/fcm/send/abc")).isTrue();
        assertThat(PushEndpoints.isAllowed("https://updates.push.services.mozilla.com/wpush/v2/x")).isTrue();
        assertThat(PushEndpoints.isAllowed("https://web.push.apple.com/Qx")).isTrue();
        assertThat(PushEndpoints.isAllowed("https://db5p.notify.windows.com/?token=1")).isTrue();
    }

    @Test
    void rejectsInternalPlainHttpAndLookalikeHosts() {
        assertThat(PushEndpoints.isAllowed("http://fcm.googleapis.com/x")).isFalse();
        assertThat(PushEndpoints.isAllowed("https://169.254.169.254/latest")).isFalse();
        assertThat(PushEndpoints.isAllowed("https://localhost/x")).isFalse();
        assertThat(PushEndpoints.isAllowed("https://fcm.googleapis.com.evil.com/x")).isFalse();
        assertThat(PushEndpoints.isAllowed("https://evil.com@fcm.googleapis.com/x")).isFalse();
        assertThat(PushEndpoints.isAllowed("https://fcm.googleapis.com:8080/x")).isFalse();
        assertThat(PushEndpoints.isAllowed("not a url")).isFalse();
        assertThat(PushEndpoints.isAllowed(null)).isFalse();
    }
}
