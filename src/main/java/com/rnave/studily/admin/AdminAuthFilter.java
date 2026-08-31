package com.rnave.studily.admin;

import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
public class AdminAuthFilter extends OncePerRequestFilter {

    public static final String SESSION_ATTRIBUTE = "studily.admin.session";
    public static final String USER_ATTRIBUTE = "studily.admin.user";
    static final String TOKEN_HEADER = "X-Admin-Token";

    private static final String PREFIX = "/api/admin";
    private static final Set<String> UNLOCK_PATHS = Set.of("/api/admin/status", "/api/admin/session");

    private final AdminGuard adminGuard;
    private final AdminSessionService sessionService;
    private final UserRepository userRepository;

    public AdminAuthFilter(AdminGuard adminGuard, AdminSessionService sessionService,
                           UserRepository userRepository) {
        this.adminGuard = adminGuard;
        this.sessionService = sessionService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (!uri.equals(PREFIX) && !uri.startsWith(PREFIX + "/")) {
            filterChain.doFilter(request, response);
            return;
        }

        User user = resolveAdmin();
        if (user == null) {
            notFound(response);
            return;
        }
        request.setAttribute(USER_ATTRIBUTE, user);

        if (UNLOCK_PATHS.contains(uri)) {
            sessionService.parse(request.getHeader(TOKEN_HEADER))
                    .filter(parsed -> matches(parsed, user))
                    .ifPresent(parsed -> request.setAttribute(SESSION_ATTRIBUTE, parsed));
            filterChain.doFilter(request, response);
            return;
        }

        var session = sessionService.parse(request.getHeader(TOKEN_HEADER))
                .filter(parsed -> matches(parsed, user))
                .orElse(null);
        if (session == null) {
            locked(response);
            return;
        }
        request.setAttribute(SESSION_ATTRIBUTE, session);
        filterChain.doFilter(request, response);
    }

    private boolean matches(AdminSessionService.Parsed parsed, User user) {
        return parsed.userId().equals(user.getId()) && parsed.tokenVersion() == user.getTokenVersion();
    }

    private User resolveAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            return null;
        }
        return userRepository.findById(userId).filter(adminGuard::isAdmin).orElse(null);
    }

    private void notFound(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":404,\"error\":\"Not Found\",\"message\":\"Not found\"}");
    }

    private void locked(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":401,\"error\":\"Unauthorized\",\"code\":\"ADMIN_LOCKED\","
                        + "\"message\":\"Admin session expired. Unlock again.\"}");
    }
}
