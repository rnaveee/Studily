package com.rnave.studily.notification;

import com.rnave.studily.push.PushPayload;
import com.rnave.studily.push.WebPushSender;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationDispatcherTest {

    private NotificationRepository notificationRepository;
    private WebPushSender webPushSender;
    private NotificationDispatcher dispatcher;
    private User user;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        webPushSender = mock(WebPushSender.class);
        dispatcher = new NotificationDispatcher(notificationRepository, webPushSender);
        user = new User();
        user.setId(1L);
    }

    @Test
    void savesAndPushesWhenNotDeduped() {
        when(notificationRepository.existsByUserIdAndDedupKey(1L, "KEY:1")).thenReturn(false);

        dispatcher.dispatch(user, NotificationType.CLASS_REMINDER, 5L,
                "KEY:1", "Class in 1 hour", "CMPT 300 starts at 10:30", "/");

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getDedupKey()).isEqualTo("KEY:1");
        assertThat(saved.getValue().getMessage()).isEqualTo("CMPT 300 starts at 10:30");

        ArgumentCaptor<PushPayload> payload = ArgumentCaptor.forClass(PushPayload.class);
        verify(webPushSender).sendToUser(eq(1L), payload.capture(),
                eq(NotificationType.CLASS_REMINDER.pushTtlSeconds()));
        assertThat(payload.getValue().title()).isEqualTo("Class in 1 hour");
    }

    @Test
    void skipsEntirelyWhenDeduped() {
        when(notificationRepository.existsByUserIdAndDedupKey(1L, "KEY:1")).thenReturn(true);

        dispatcher.dispatch(user, NotificationType.CLASS_REMINDER, 5L,
                "KEY:1", "Class in 1 hour", "body", "/");

        verify(notificationRepository, never()).saveAndFlush(any());
        verify(webPushSender, never()).sendToUser(any(), any(), anyInt());
    }
}
