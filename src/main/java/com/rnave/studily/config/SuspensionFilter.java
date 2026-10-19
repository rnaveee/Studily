package com.rnave.studily.config;

import com.rnave.studily.admin.AdminGuard;
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
import java.time.Clock;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class SuspensionFilter extends OncePerRequestFilter {

    public static final String CODE = "ACCOUNT_SUSPENDED";

    private static final String BODY = "{\"status\":403,\"error\":\"Forbidden\",\"code\":\"" + CODE
            + "\",\"message\":\"Your account is suspended\"}";
    private static final Pattern AVATAR_PATH = Pattern.compile("^/api/users/\\d+/avatar$");
    private static final Set<String> ALLOWED_POSTS = Set.of(
            "/api/push/rotate",
            "/api/push/unsubscribe",
            "/api/support",
            "/api/me/token",
            "/api/me/delete");
    private static final Set<String> ALLOWED_GETS = Set.of("/api/me", "/api/me/moderation");

    private final UserRepository userRepository;
    private final AdminGuard adminGuard;
    private final Clock clock;

    public SuspensionFilter(UserRepository userRepository, AdminGuard adminGuard, Clock clock) {
        this.userRepository = userRepository;
        this.adminGuard = adminGuard;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (uri == null || !uri.startsWith("/api/")
                || auth == null || !(auth.getPrincipal() instanceof Long userId)
                || isAllowed(request.getMethod(), uri)) {
            filterChain.doFilter(request, response);
            return;
        }

        User user = request.getAttribute(JwtAuthFilter.USER_ATTRIBUTE) instanceof User stashed
                && userId.equals(stashed.getId())
                ? stashed
                : userRepository.findById(userId).orElse(null);
        if (user == null || adminGuard.isAdmin(user) || !user.isSuspendedAt(clock.instant())) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write(BODY);
    }

    static boolean isAllowed(String method, String uri) {
        if (uri.startsWith("/api/auth/")) {
            return true;
        }
        return switch (method == null ? "" : method) {
            case "GET" -> uri.startsWith("/api/public/") || ALLOWED_GETS.contains(uri)
                    || AVATAR_PATH.matcher(uri).matches();
            case "POST" -> ALLOWED_POSTS.contains(uri);
            default -> false;
        };
    }
}
