package com.rnave.studily.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private static final int MIN_SECRET_LENGTH = 64;
    private static final String DEV_PREFIX = "dev-only";

    private final String rawSecret;
    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.rawSecret = secret;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    @PostConstruct
    void validate() {
        if (rawSecret.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException(
                "JWT secret is too short (" + rawSecret.length() + " chars). " +
                "Set the JWT_SECRET environment variable to a random string of at least " +
                MIN_SECRET_LENGTH + " characters.");
        }
        if (rawSecret.startsWith(DEV_PREFIX)) {
            log.warn("\n" +
                "╔══════════════════════════════════════════════════════════════╗\n" +
                "║  WARNING: dev-only JWT secret in use.                        ║\n" +
                "║  Set JWT_SECRET env var before deploying to production!       ║\n" +
                "╚══════════════════════════════════════════════════════════════╝");
        }
    }

    public String generateToken(Long userId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    public Long parseUserId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return Long.valueOf(claims.getSubject());
    }
}
