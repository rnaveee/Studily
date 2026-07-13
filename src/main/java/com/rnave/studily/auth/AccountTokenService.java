package com.rnave.studily.auth;

import com.rnave.studily.user.User;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class AccountTokenService {

    private static final Duration VERIFY_TTL = Duration.ofHours(24);
    private static final Duration RESET_TTL = Duration.ofHours(1);

    private final AccountTokenRepository repository;
    private final SecureRandom random = new SecureRandom();

    public AccountTokenService(AccountTokenRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public String issue(User user, AccountTokenType type) {
        repository.deleteByUserIdAndType(user.getId(), type);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        AccountToken token = new AccountToken();
        token.setUser(user);
        token.setTokenHash(hash(raw));
        token.setType(type);
        token.setExpiresAt(Instant.now().plus(type == AccountTokenType.EMAIL_VERIFY ? VERIFY_TTL : RESET_TTL));
        repository.save(token);
        return raw;
    }

    @Transactional
    public Optional<User> consume(String rawToken, AccountTokenType type) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        return repository.findByTokenHashAndType(hash(rawToken.trim()), type)
                .map(token -> {
                    repository.delete(token);
                    return token.getExpiresAt().isAfter(Instant.now()) ? token.getUser() : null;
                });
    }

    static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Scheduled(fixedRate = 6 * 60 * 60 * 1000)
    @Transactional
    void purgeExpired() {
        repository.deleteByExpiresAtBefore(Instant.now());
    }
}
