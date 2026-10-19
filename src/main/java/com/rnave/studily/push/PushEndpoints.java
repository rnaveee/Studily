package com.rnave.studily.push;

import java.net.URI;
import java.util.List;
import java.util.Locale;

final class PushEndpoints {

    private static final List<String> ALLOWED_HOST_SUFFIXES = List.of(
            "fcm.googleapis.com",
            "android.googleapis.com",
            "push.services.mozilla.com",
            "push.apple.com",
            "notify.windows.com");

    private PushEndpoints() {
    }

    static boolean isAllowed(String endpoint) {
        if (endpoint == null) {
            return false;
        }
        URI uri;
        try {
            uri = URI.create(endpoint.trim());
        } catch (IllegalArgumentException e) {
            return false;
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            return false;
        }
        if (uri.getPort() != -1 && uri.getPort() != 443) {
            return false;
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        return ALLOWED_HOST_SUFFIXES.stream()
                .anyMatch(suffix -> host.equals(suffix) || host.endsWith("." + suffix));
    }
}
