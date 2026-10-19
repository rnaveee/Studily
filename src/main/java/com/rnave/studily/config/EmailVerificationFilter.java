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
import java.util.regex.Pattern;

@Component
public class EmailVerificationFilter extends OncePerRequestFilter {

    static final String MESSAGE = "Verify your email to use messaging and friends";
    static final String PARSE_MESSAGE = "Verify your email to build a course from an outline";
    static final String REPORT_MESSAGE = "Verify your email to send reports";
    static final String GENERATE_MESSAGE = "Verify your email to make flashcards from documents";

    private static final List<String> LOCKED_PREFIXES = List.of("/api/friends", "/api/conversations", "/api/reports");
    private static final String PARSE_PATH = "/api/courses/parse";
    private static final String SCHEDULE_PARSE_PATH = "/api/courses/parse/schedule";
    private static final Pattern GENERATE_PATHS = Pattern.compile("^/api/flashcard-sets(/\\d+)?/generate/?$");
    private static final Pattern LOCKED_USER_PATHS = Pattern.compile("^/api/users/[^/]+/(progress|badges)/?$");

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
        boolean generate = GENERATE_PATHS.matcher(uri).matches();
        boolean locked = LOCKED_PREFIXES.stream().anyMatch(uri::startsWith) || isParse(uri) || generate
                || LOCKED_USER_PATHS.matcher(uri).matches();
        if (!locked) {
            filterChain.doFilter(request, response);
            return;
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long userId) {
            boolean verified = userRepository.findById(userId).map(User::isEmailVerified).orElse(false);
            if (!verified) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                String message = isParse(uri) ? PARSE_MESSAGE
                        : generate ? GENERATE_MESSAGE
                        : uri.startsWith("/api/reports") ? REPORT_MESSAGE : MESSAGE;
                response.getWriter().write(
                        "{\"status\":403,\"error\":\"Forbidden\",\"code\":\"EMAIL_UNVERIFIED\","
                                + "\"message\":\"" + message + "\"}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private static boolean isParse(String uri) {
        return uri.equals(PARSE_PATH) || uri.equals(SCHEDULE_PARSE_PATH);
    }
}
