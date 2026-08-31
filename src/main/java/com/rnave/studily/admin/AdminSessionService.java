package com.rnave.studily.admin;

import com.rnave.studily.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AdminSessionService {

    private static final Logger log = LoggerFactory.getLogger(AdminSessionService.class);
    private static final String DERIVATION_LABEL = "studily-admin-step-up-v1";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final byte[] key;
    private final long sessionMs;
    private final String totpSecret;
    private final SecureRandom random = new SecureRandom();
    private final AtomicLong epoch = new AtomicLong(System.currentTimeMillis());

    public AdminSessionService(
            @Value("${app.jwt.secret}") String jwtSecret,
            @Value("${app.admin.token-secret:}") String adminSecret,
            @Value("${app.admin.totp-secret:}") String totpSecret,
            @Value("${app.admin.session-ms:1800000}") long sessionMs) {
        String configured = adminSecret == null ? "" : adminSecret.trim();
        this.key = configured.isEmpty()
                ? hmac(jwtSecret.getBytes(StandardCharsets.UTF_8), DERIVATION_LABEL)
                : configured.getBytes(StandardCharsets.UTF_8);
        this.sessionMs = sessionMs;
        this.totpSecret = totpSecret == null ? "" : totpSecret.trim();
        if (this.totpSecret.isEmpty()) {
            log.warn("ADMIN_TOTP_SECRET is not set; the admin dashboard is protected by password only");
        }
    }

    public boolean totpEnabled() {
        return !totpSecret.isBlank();
    }

    public boolean verifyTotp(String code) {
        return Totp.verify(totpSecret, code);
    }

    public long sessionMs() {
        return sessionMs;
    }

    public Issued issue(User user) {
        long expiresAt = System.currentTimeMillis() + sessionMs;
        byte[] nonceBytes = new byte[12];
        random.nextBytes(nonceBytes);
        String payload = "%d:%d:%d:%d:%s".formatted(
                user.getId(), user.getTokenVersion(), expiresAt, epoch.get(),
                ENCODER.encodeToString(nonceBytes));
        String encoded = ENCODER.encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String signature = ENCODER.encodeToString(hmac(key, encoded));
        return new Issued(encoded + "." + signature, Instant.ofEpochMilli(expiresAt));
    }

    public Optional<Parsed> parse(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        int dot = token.lastIndexOf('.');
        if (dot <= 0) {
            return Optional.empty();
        }
        String encoded = token.substring(0, dot);
        String signature = token.substring(dot + 1);
        byte[] expected = hmac(key, encoded);
        byte[] provided;
        String payload;
        try {
            provided = DECODER.decode(signature);
            payload = new String(DECODER.decode(encoded), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        if (!MessageDigest.isEqual(expected, provided)) {
            return Optional.empty();
        }
        String[] parts = payload.split(":");
        if (parts.length < 4) {
            return Optional.empty();
        }
        try {
            long userId = Long.parseLong(parts[0]);
            int tokenVersion = Integer.parseInt(parts[1]);
            long expiresAt = Long.parseLong(parts[2]);
            long tokenEpoch = Long.parseLong(parts[3]);
            if (expiresAt <= System.currentTimeMillis() || tokenEpoch != epoch.get()) {
                return Optional.empty();
            }
            return Optional.of(new Parsed(userId, tokenVersion, Instant.ofEpochMilli(expiresAt)));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public void revokeAll() {
        epoch.incrementAndGet();
    }

    public Duration remaining(Instant expiresAt) {
        return Duration.between(Instant.now(), expiresAt);
    }

    private static byte[] hmac(byte[] key, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public record Issued(String token, Instant expiresAt) {
    }

    public record Parsed(Long userId, int tokenVersion, Instant expiresAt) {
    }
}
