package com.rnave.studily.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class GlobalRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000;

    private static final String FLASHCARD_IMAGES = "/api/public/flashcard-images/";

    private static final String CALENDAR_FEED = "/api/public/calendar/";

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(120, WINDOW_MS);
    private final SlidingWindowRateLimiter imageLimiter = new SlidingWindowRateLimiter(600, WINDOW_MS);
    private final SlidingWindowRateLimiter feedTokenLimiter = new SlidingWindowRateLimiter(30, WINDOW_MS);
    private final SlidingWindowRateLimiter feedIpLimiter = new SlidingWindowRateLimiter(600, WINDOW_MS);

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (!uri.startsWith("/api/") || uri.startsWith("/api/auth/")) {
            filterChain.doFilter(request, response);
            return;
        }

        String feedToken = feedToken(uri);
        if (feedToken != null) {
            if (!feedIpLimiter.tryConsume("ip:" + clientIp(request))
                    || !feedTokenLimiter.tryConsume("feed:" + feedToken)) {
                RateLimitResponses.reject(response, "Too many requests, please slow down.");
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }

        SlidingWindowRateLimiter bucket = uri.startsWith(FLASHCARD_IMAGES) ? imageLimiter : limiter;
        if (!bucket.tryConsume(rateLimitKey(request))) {
            RateLimitResponses.reject(response, "Too many requests, please slow down.");
            return;
        }
        filterChain.doFilter(request, response);
    }

    static String feedToken(String uri) {
        if (!uri.startsWith(CALENDAR_FEED)) {
            return null;
        }
        String rest = uri.substring(CALENDAR_FEED.length());
        if (rest.endsWith(".ics")) {
            rest = rest.substring(0, rest.length() - 4);
        }
        return rest.length() > 128 ? rest.substring(0, 128) : rest;
    }

    private String rateLimitKey(HttpServletRequest request) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long userId) {
            return "user:" + userId;
        }
        return "ip:" + clientIp(request);
    }

    public static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] hops = forwarded.split(",");
            return hops[hops.length - 1].trim();
        }
        return request.getRemoteAddr();
    }

    @Scheduled(fixedRate = 10 * WINDOW_MS)
    void evictStale() {
        limiter.evictStale();
        imageLimiter.evictStale();
        feedTokenLimiter.evictStale();
        feedIpLimiter.evictStale();
    }
}
