package com.rnave.studily.push;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.push.PushController.Keys;
import com.rnave.studily.push.PushController.RotateRequest;
import com.rnave.studily.push.PushController.SubscribeRequest;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PushControllerTest {

    private static final String ENDPOINT = "https://push.example.com/abc";
    private static final String NEW_ENDPOINT = "https://push.example.com/xyz";

    private PushSubscriptionRepository repository;
    private CurrentUser currentUser;
    private PushController controller;

    @BeforeEach
    void setUp() {
        repository = mock(PushSubscriptionRepository.class);
        currentUser = mock(CurrentUser.class);
        controller = new PushController(mock(WebPushSender.class), repository, currentUser);
    }

    @Test
    void rotateWithMatchingOldKeys_movesSubscription() {
        PushSubscription existing = subscription(1L, user(7L), ENDPOINT, "p-old", "a-old");
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));
        when(repository.findByEndpoint(NEW_ENDPOINT)).thenReturn(Optional.empty());

        controller.rotate(new RotateRequest(
                ENDPOINT, new Keys("p-old", "a-old"), NEW_ENDPOINT, new Keys("p-new", "a-new")));

        assertThat(existing.getEndpoint()).isEqualTo(NEW_ENDPOINT);
        assertThat(existing.getAuth()).isEqualTo("a-new");
    }

    @Test
    void rotateWithWrongOldKeys_isIgnored() {
        PushSubscription existing = subscription(1L, user(7L), ENDPOINT, "p-old", "a-old");
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));

        controller.rotate(new RotateRequest(
                ENDPOINT, new Keys("p-guess", "a-guess"), NEW_ENDPOINT, new Keys("p-new", "a-new")));

        assertThat(existing.getEndpoint()).isEqualTo(ENDPOINT);
        assertThat(existing.getAuth()).isEqualTo("a-old");
        verify(repository, never()).delete(any());
    }

    @Test
    void subscribeToAnotherUsersEndpointWithoutKeys_isRejected() {
        PushSubscription existing = subscription(1L, user(7L), ENDPOINT, "p-old", "a-old");
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));
        when(currentUser.entity()).thenReturn(user(99L));

        assertThatThrownBy(() -> controller.subscribe(
                new SubscribeRequest(ENDPOINT, new Keys("p-guess", "a-guess"))))
                .isInstanceOf(ConflictException.class);

        assertThat(existing.getUser().getId()).isEqualTo(7L);
        verify(repository, never()).save(any());
    }

    @Test
    void subscribeOnSharedDeviceWithSameKeys_reassignsToNewUser() {
        PushSubscription existing = subscription(1L, user(7L), ENDPOINT, "p-old", "a-old");
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.of(existing));
        when(currentUser.entity()).thenReturn(user(99L));

        controller.subscribe(new SubscribeRequest(ENDPOINT, new Keys("p-old", "a-old")));

        assertThat(existing.getUser().getId()).isEqualTo(99L);
        verify(repository).save(existing);
    }

    @Test
    void subscribeWithNewEndpoint_createsSubscription() {
        when(repository.findByEndpoint(ENDPOINT)).thenReturn(Optional.empty());
        when(currentUser.entity()).thenReturn(user(99L));

        controller.subscribe(new SubscribeRequest(ENDPOINT, new Keys("p", "a")));

        verify(repository).save(any(PushSubscription.class));
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static PushSubscription subscription(Long id, User user, String endpoint,
                                                 String p256dh, String auth) {
        PushSubscription subscription = new PushSubscription();
        subscription.setId(id);
        subscription.setUser(user);
        subscription.setEndpoint(endpoint);
        subscription.setP256dh(p256dh);
        subscription.setAuth(auth);
        return subscription;
    }
}
