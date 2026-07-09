package com.rnave.studily.config;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class LoginRateLimiter {

    private static final long WINDOW_MS = 15 * 60_000;

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(10, WINDOW_MS);

    public boolean tryConsume(String email) {
        return limiter.tryConsume(email);
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStale() {
        limiter.evictStale();
    }
}
