package com.rnave.studily.donation;

import com.rnave.studily.config.SlidingWindowRateLimiter;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DonationCheckoutRateLimiter {

    private static final long WINDOW_MS = 10 * 60_000;

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(5, WINDOW_MS);

    public boolean tryConsume(Long userId) {
        return limiter.tryConsume("user:" + userId);
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStale() {
        limiter.evictStale();
    }
}
