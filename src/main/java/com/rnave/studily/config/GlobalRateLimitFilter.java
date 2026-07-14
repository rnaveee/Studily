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

    private final SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(120, WINDOW_MS);

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

        if (!limiter.tryConsume(rateLimitKey(request))) {
            RateLimitResponses.reject(response, "Too many requests, please slow down.");
            return;
        }
        filterChain.doFilter(request, response);
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
    }
}
