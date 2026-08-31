package com.rnave.studily.admin;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;

public final class Totp {

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int DIGITS = 6;
    private static final long STEP_SECONDS = 30;
    private static final int DRIFT_STEPS = 1;

    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    public static String randomSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32Encode(bytes);
    }

    public static String provisioningUri(String secret, String account, String issuer) {
        return "otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d".formatted(
                pathEncode(issuer),
                pathEncode(account),
                secret,
                URLEncoder.encode(issuer, StandardCharsets.UTF_8),
                DIGITS,
                STEP_SECONDS);
    }

    private static String pathEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    public static boolean verify(String secret, String code) {
        if (secret == null || secret.isBlank() || code == null) {
            return false;
        }
        String digits = code.replaceAll("\\s", "");
        if (digits.length() != DIGITS || !digits.chars().allMatch(Character::isDigit)) {
            return false;
        }
        byte[] key;
        try {
            key = base32Decode(secret);
        } catch (IllegalArgumentException e) {
            return false;
        }
        long counter = System.currentTimeMillis() / 1000L / STEP_SECONDS;
        for (long offset = -DRIFT_STEPS; offset <= DRIFT_STEPS; offset++) {
            String expected = generate(key, counter + offset);
            if (MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    digits.getBytes(StandardCharsets.UTF_8))) {
                return true;
            }
        }
        return false;
    }

    private static String generate(byte[] key, long counter) {
        byte[] data = new byte[8];
        long value = counter;
        for (int i = 7; i >= 0; i--) {
            data[i] = (byte) (value & 0xff);
            value >>>= 8;
        }
        byte[] hash;
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            hash = mac.doFinal(data);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        int offset = hash[hash.length - 1] & 0x0f;
        int binary = ((hash[offset] & 0x7f) << 24)
                | ((hash[offset + 1] & 0xff) << 16)
                | ((hash[offset + 2] & 0xff) << 8)
                | (hash[offset + 3] & 0xff);
        int otp = binary % 1_000_000;
        return "%06d".formatted(otp);
    }

    static String base32Encode(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : bytes) {
            buffer = (buffer << 8) | (b & 0xff);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                out.append(ALPHABET.charAt((buffer >> (bitsLeft - 5)) & 0x1f));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            out.append(ALPHABET.charAt((buffer << (5 - bitsLeft)) & 0x1f));
        }
        return out.toString();
    }

    static byte[] base32Decode(String encoded) {
        String clean = encoded.replaceAll("[=\\s-]", "").toUpperCase(Locale.ROOT);
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Empty secret");
        }
        byte[] out = new byte[clean.length() * 5 / 8];
        int buffer = 0;
        int bitsLeft = 0;
        int index = 0;
        for (char c : clean.toCharArray()) {
            int value = ALPHABET.indexOf(c);
            if (value < 0) {
                throw new IllegalArgumentException("Not a base32 secret");
            }
            buffer = (buffer << 5) | value;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out[index++] = (byte) ((buffer >> (bitsLeft - 8)) & 0xff);
                bitsLeft -= 8;
            }
        }
        return out;
    }
}
