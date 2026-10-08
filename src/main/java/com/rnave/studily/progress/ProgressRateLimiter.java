package com.rnave.studily.progress;

import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ProgressRateLimiter {

    private static final long WINDOW_MS = 60_000;
    static final int LIMIT_PER_MINUTE = 60;

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(LIMIT_PER_MINUTE, WINDOW_MS);

    public void check(Long userId) {
        if (!limiter.tryConsume("user:" + userId)) {
            throw new TooManyRequestsException("Too many requests, please slow down.");
        }
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStale() {
        limiter.evictStale();
    }
}
