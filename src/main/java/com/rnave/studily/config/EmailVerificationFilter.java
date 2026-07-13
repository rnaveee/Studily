package com.rnave.studily.config;

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
import java.util.List;

@Component
public class EmailVerificationFilter extends OncePerRequestFilter {

    static final String MESSAGE = "Verify your email to use messaging and friends";

    private static final List<String> LOCKED_PREFIXES = List.of("/api/friends", "/api/conversations");

    private final UserRepository userRepository;

    public EmailVerificationFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (LOCKED_PREFIXES.stream().noneMatch(uri::startsWith)) {
            filterChain.doFilter(request, response);
            return;
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long userId) {
            boolean verified = userRepository.findById(userId).map(User::isEmailVerified).orElse(false);
            if (!verified) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"status\":403,\"error\":\"Forbidden\",\"code\":\"EMAIL_UNVERIFIED\","
                                + "\"message\":\"" + MESSAGE + "\"}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
