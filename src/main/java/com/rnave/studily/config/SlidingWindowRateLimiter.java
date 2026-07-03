package com.rnave.studily.config;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

final class SlidingWindowRateLimiter {

    private final int limitPerWindow;
    private final long windowMs;
    private final long staleAfterMs;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    SlidingWindowRateLimiter(int limitPerWindow, long windowMs) {
        this.limitPerWindow = limitPerWindow;
        this.windowMs = windowMs;
        this.staleAfterMs = windowMs * 10;
    }

    boolean tryConsume(String key) {
        return windows.computeIfAbsent(key, k -> new Window()).tryConsume();
    }

    void evictStale() {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> now - e.getValue().windowStart >= staleAfterMs);
    }

    private final class Window {
        volatile long windowStart = System.currentTimeMillis();
        final AtomicInteger count = new AtomicInteger(0);

        synchronized boolean tryConsume() {
            long now = System.currentTimeMillis();
            if (now - windowStart >= windowMs) {
                windowStart = now;
                count.set(0);
            }
            return count.incrementAndGet() <= limitPerWindow;
        }
    }
}
