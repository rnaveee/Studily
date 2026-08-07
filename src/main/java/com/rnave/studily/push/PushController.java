package com.rnave.studily.push;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final WebPushSender webPushSender;
    private final PushSubscriptionRepository subscriptionRepository;
    private final CurrentUser currentUser;

    public PushController(WebPushSender webPushSender,
                          PushSubscriptionRepository subscriptionRepository,
                          CurrentUser currentUser) {
        this.webPushSender = webPushSender;
        this.subscriptionRepository = subscriptionRepository;
        this.currentUser = currentUser;
    }

    @GetMapping("/public-key")
    public PublicKeyDto publicKey() {
        return new PublicKeyDto(webPushSender.isEnabled() ? webPushSender.getPublicKey() : null);
    }

    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void subscribe(@Valid @RequestBody SubscribeRequest request) {
        User me = currentUser.entity();
        PushSubscription subscription = subscriptionRepository
                .findByEndpoint(request.endpoint())
                .orElseGet(PushSubscription::new);
        if (subscription.getId() != null
                && !subscription.getUser().getId().equals(me.getId())
                && !keysMatch(subscription, request.keys())) {
            throw new ConflictException("This push endpoint is registered to another device");
        }
        subscription.setUser(me);
        subscription.setEndpoint(request.endpoint());
        subscription.setP256dh(request.keys().p256dh());
        subscription.setAuth(request.keys().auth());
        subscriptionRepository.save(subscription);
    }

    @PostMapping("/unsubscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@Valid @RequestBody UnsubscribeRequest request) {
        subscriptionRepository.deleteByUserIdAndEndpoint(currentUser.id(), request.endpoint());
    }

    @PostMapping("/rotate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void rotate(@Valid @RequestBody RotateRequest request) {
        subscriptionRepository.findByEndpoint(request.oldEndpoint()).ifPresent(subscription -> {
            if (!keysMatch(subscription, request.oldKeys())) {
                return;
            }
            subscriptionRepository.findByEndpoint(request.endpoint())
                    .filter(other -> !other.getId().equals(subscription.getId()))
                    .ifPresent(subscriptionRepository::delete);
            subscription.setEndpoint(request.endpoint());
            subscription.setP256dh(request.keys().p256dh());
            subscription.setAuth(request.keys().auth());
        });
    }

    private static boolean keysMatch(PushSubscription subscription, Keys keys) {
        return constantTimeEquals(subscription.getAuth(), keys.auth())
                && constantTimeEquals(subscription.getP256dh(), keys.p256dh());
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    public record PublicKeyDto(String publicKey) {}

    public record SubscribeRequest(@NotBlank @Size(max = 2048) String endpoint, @NotNull @Valid Keys keys) {}

    public record Keys(@NotBlank @Size(max = 256) String p256dh, @NotBlank @Size(max = 256) String auth) {}

    public record UnsubscribeRequest(@NotBlank @Size(max = 2048) String endpoint) {}

    public record RotateRequest(@NotBlank @Size(max = 2048) String oldEndpoint,
                                @NotNull @Valid Keys oldKeys,
                                @NotBlank @Size(max = 2048) String endpoint,
                                @NotNull @Valid Keys keys) {}
}
