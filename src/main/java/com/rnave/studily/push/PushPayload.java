package com.rnave.studily.push;

public record PushPayload(String title, String body, String url) {

    private static final int MAX_BODY = 160;

    public static PushPayload of(String title, String body, String url) {
        String trimmed = body == null ? "" : body;
        if (trimmed.length() > MAX_BODY) {
            trimmed = trimmed.substring(0, MAX_BODY - 1) + "…";
        }
        return new PushPayload(title, trimmed, url);
    }
}
