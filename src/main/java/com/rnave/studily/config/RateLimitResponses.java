package com.rnave.studily.config;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

final class RateLimitResponses {

    private RateLimitResponses() {
    }

    static void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"" + message + "\"}");
    }
}
