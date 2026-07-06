package com.rnave.studily.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String VALID_SECRET = "a".repeat(64);
    // Long enough for jjwt's own HMAC-SHA256 key-strength check (>= 32 bytes) but still
    // short of this app's own 64-char minimum, so it isolates JwtService#validate's own guard.
    private static final String SHORT_BUT_HMAC_VALID_SECRET = "a".repeat(40);

    @Test
    void generateToken_thenParseToken_roundTrips() {
        JwtService jwtService = new JwtService(VALID_SECRET, 60_000);

        String token = jwtService.generateToken(42L, 3);

        assertThat(jwtService.parseToken(token)).isEqualTo(new JwtService.TokenPayload(42L, 3));
    }

    @Test
    void parseToken_treatsTokenWithoutVersionClaimAsVersionZero() {
        JwtService jwtService = new JwtService(VALID_SECRET, 60_000);
        String legacyToken = Jwts.builder()
                .subject("5")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(VALID_SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(jwtService.parseToken(legacyToken)).isEqualTo(new JwtService.TokenPayload(5L, 0));
    }

    @Test
    void constructor_rejectsSecretTooShortForHmacSha256() {
        assertThatThrownBy(() -> new JwtService("too-short", 60_000)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void validate_rejectsSecretShorterThan64CharsEvenIfHmacAccepts() {
        JwtService jwtService = new JwtService(SHORT_BUT_HMAC_VALID_SECRET, 60_000);

        assertThatThrownBy(jwtService::validate).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void validate_acceptsSecretAtExactly64Chars() {
        JwtService jwtService = new JwtService(VALID_SECRET, 60_000);

        assertThatCode(jwtService::validate).doesNotThrowAnyException();
    }

    @Test
    void parseToken_rejectsTokenSignedWithADifferentSecret() {
        JwtService issuer = new JwtService(VALID_SECRET, 60_000);
        JwtService verifier = new JwtService("b".repeat(64), 60_000);
        String token = issuer.generateToken(1L, 0);

        assertThatThrownBy(() -> verifier.parseToken(token)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void parseToken_rejectsExpiredToken() {
        JwtService jwtService = new JwtService(VALID_SECRET, -1_000);

        String token = jwtService.generateToken(1L, 0);

        assertThatThrownBy(() -> jwtService.parseToken(token)).isInstanceOf(RuntimeException.class);
    }
}
