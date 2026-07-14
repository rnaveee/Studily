package com.rnave.studily.push;

import tools.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Urgency;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Security;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class WebPushSender {

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);

    private final PushService pushService;
    private final String publicKey;
    private final PushSubscriptionRepository subscriptionRepository;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public WebPushSender(@Value("${app.push.vapid.public-key}") String publicKey,
                         @Value("${app.push.vapid.private-key}") String privateKey,
                         @Value("${app.push.vapid.subject}") String subject,
                         PushSubscriptionRepository subscriptionRepository,
                         ObjectMapper objectMapper) {
        this.publicKey = publicKey;
        this.subscriptionRepository = subscriptionRepository;
        this.objectMapper = objectMapper;
        if (publicKey.isBlank() || privateKey.isBlank()) {
            log.warn("VAPID keys not configured; web push disabled");
            this.pushService = null;
        } else {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            this.pushService = createService(publicKey, privateKey, subject);
        }
    }

    private static PushService createService(String publicKey, String privateKey, String subject) {
        try {
            return new PushService(publicKey, privateKey, subject);
        } catch (Exception e) {
            log.error("Invalid VAPID keys; web push disabled", e);
            return null;
        }
    }

    public boolean isEnabled() {
        return pushService != null;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void sendToUser(Long userId, PushPayload payload, int ttlSeconds) {
        if (!isEnabled()) {
            return;
        }
        List<PushSubscription> subscriptions = subscriptionRepository.findByUserId(userId);
        for (PushSubscription subscription : subscriptions) {
            String endpoint = subscription.getEndpoint();
            String p256dh = subscription.getP256dh();
            String auth = subscription.getAuth();
            executor.submit(() -> sendOne(endpoint, p256dh, auth, payload, ttlSeconds));
        }
    }

    private void sendOne(String endpoint, String p256dh, String auth, PushPayload payload, int ttlSeconds) {
        try {
            byte[] body = objectMapper.writeValueAsBytes(payload);
            Notification notification = Notification.builder()
                    .endpoint(endpoint)
                    .userPublicKey(p256dh)
                    .userAuth(auth)
                    .payload(body)
                    .ttl(ttlSeconds)
                    .urgency(Urgency.HIGH)
                    .build();
            HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) {
                subscriptionRepository.deleteByEndpoint(endpoint);
            } else if (status >= 400) {
                log.warn("Push endpoint returned {}", status);
            }
        } catch (Exception e) {
            log.warn("Failed to send push: {}", e.getMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}
