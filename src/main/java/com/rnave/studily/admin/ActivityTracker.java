package com.rnave.studily.admin;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ActivityTracker extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ActivityTracker.class);
    private static final long THROTTLE_MS = 5 * 60_000;

    private final JdbcTemplate jdbc;
    private final ConcurrentHashMap<Long, Long> lastWrite = new ConcurrentHashMap<>();

    public ActivityTracker(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        filterChain.doFilter(request, response);

        if (!request.getRequestURI().startsWith("/api/")) {
            return;
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            return;
        }
        long now = System.currentTimeMillis();
        Long previous = lastWrite.get(userId);
        if (previous != null && now - previous < THROTTLE_MS) {
            return;
        }
        lastWrite.put(userId, now);
        try {
            jdbc.update("UPDATE users SET last_active_at = now() WHERE id = ?", userId);
        } catch (RuntimeException e) {
            log.debug("Could not record activity for user {}", userId, e);
        }
    }

    @Scheduled(fixedRate = 6 * 60 * 60 * 1000)
    void evictStale() {
        long cutoff = System.currentTimeMillis() - THROTTLE_MS * 4;
        lastWrite.entrySet().removeIf(entry -> entry.getValue() < cutoff);
    }
}
