package com.rnave.studily.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String VALID_SECRET = "a".repeat(64);
    // Long enough for jjwt's own HMAC-SHA256 key-strength check (>= 32 bytes) but still
    // short of this app's own 64-char minimum, so it isolates JwtService#validate's own guard.
    private static final String SHORT_BUT_HMAC_VALID_SECRET = "a".repeat(40);

    @Test
    void generateToken_thenParseUserId_roundTrips() {
        JwtService jwtService = new JwtService(VALID_SECRET, 60_000);

        String token = jwtService.generateToken(42L);

        assertThat(jwtService.parseUserId(token)).isEqualTo(42L);
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
    void parseUserId_rejectsTokenSignedWithADifferentSecret() {
        JwtService issuer = new JwtService(VALID_SECRET, 60_000);
        JwtService verifier = new JwtService("b".repeat(64), 60_000);
        String token = issuer.generateToken(1L);

        assertThatThrownBy(() -> verifier.parseUserId(token)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void parseUserId_rejectsExpiredToken() {
        JwtService jwtService = new JwtService(VALID_SECRET, -1_000);

        String token = jwtService.generateToken(1L);

        assertThatThrownBy(() -> jwtService.parseUserId(token)).isInstanceOf(RuntimeException.class);
    }
}
