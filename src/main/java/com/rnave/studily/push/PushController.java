package com.rnave.studily.push;

import com.rnave.studily.config.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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
        PushSubscription subscription = subscriptionRepository
                .findByEndpoint(request.endpoint())
                .orElseGet(PushSubscription::new);
        subscription.setUser(currentUser.entity());
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
            subscriptionRepository.findByEndpoint(request.endpoint())
                    .filter(other -> !other.getId().equals(subscription.getId()))
                    .ifPresent(subscriptionRepository::delete);
            subscription.setEndpoint(request.endpoint());
            subscription.setP256dh(request.keys().p256dh());
            subscription.setAuth(request.keys().auth());
        });
    }

    public record PublicKeyDto(String publicKey) {}

    public record SubscribeRequest(@NotBlank String endpoint, @NotNull @Valid Keys keys) {}

    public record Keys(@NotBlank String p256dh, @NotBlank String auth) {}

    public record UnsubscribeRequest(@NotBlank String endpoint) {}

    public record RotateRequest(@NotBlank String oldEndpoint,
                                @NotBlank String endpoint,
                                @NotNull @Valid Keys keys) {}
}
