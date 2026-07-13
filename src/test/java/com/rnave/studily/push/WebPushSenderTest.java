package com.rnave.studily.push;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class WebPushSenderTest {

    @Test
    void disabledWithoutKeysAndSendIsNoOp() {
        PushSubscriptionRepository repo = mock(PushSubscriptionRepository.class);
        WebPushSender sender = new WebPushSender("", "", "mailto:test@example.com",
                repo, new ObjectMapper());

        assertThat(sender.isEnabled()).isFalse();
        sender.sendToUser(1L, PushPayload.of("t", "b", "/"));
        verifyNoInteractions(repo);
    }

    @Test
    void payloadBodyIsTruncated() {
        PushPayload payload = PushPayload.of("t", "x".repeat(500), "/");
        assertThat(payload.body().length()).isLessThanOrEqualTo(160);
    }
}
