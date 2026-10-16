package com.rnave.studily.config;

import java.nio.charset.StandardCharsets;

public final class WebpSize {

    private WebpSize() {
    }

    public static int[] of(byte[] b) {
        if (b == null || b.length < 30 || !matchesAt(b, 0, "RIFF") || !matchesAt(b, 8, "WEBP")) {
            return null;
        }
        if (matchesAt(b, 12, "VP8X")) {
            return new int[] {u24(b, 24) + 1, u24(b, 27) + 1};
        }
        if (matchesAt(b, 12, "VP8L")) {
            int bits = u8(b, 21) | (u8(b, 22) << 8) | (u8(b, 23) << 16) | (u8(b, 24) << 24);
            return new int[] {(bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1};
        }
        if (matchesAt(b, 12, "VP8 ")) {
            return new int[] {
                ((u8(b, 27) << 8) | u8(b, 26)) & 0x3FFF,
                ((u8(b, 29) << 8) | u8(b, 28)) & 0x3FFF,
            };
        }
        return null;
    }

    private static int u8(byte[] b, int i) {
        return b[i] & 0xFF;
    }

    private static int u24(byte[] b, int i) {
        return u8(b, i) | (u8(b, i + 1) << 8) | (u8(b, i + 2) << 16);
    }

    private static boolean matchesAt(byte[] bytes, int offset, String text) {
        byte[] p = text.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < offset + p.length) {
            return false;
        }
        for (int i = 0; i < p.length; i++) {
            if (bytes[offset + i] != p[i]) {
                return false;
            }
        }
        return true;
    }
}
