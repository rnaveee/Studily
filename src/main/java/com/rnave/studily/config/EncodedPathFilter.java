package com.rnave.studily.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class EncodedPathFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (hasEncodedUnreserved(request.getRequestURI())) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"status\":400,\"error\":\"Bad Request\",\"message\":\"Malformed request path\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    static boolean hasEncodedUnreserved(String uri) {
        if (uri == null) {
            return false;
        }
        for (int i = 0; i < uri.length(); i++) {
            if (uri.charAt(i) != '%') {
                continue;
            }
            if (i + 2 >= uri.length()) {
                return true;
            }
            int high = Character.digit(uri.charAt(i + 1), 16);
            int low = Character.digit(uri.charAt(i + 2), 16);
            if (high < 0 || low < 0) {
                return true;
            }
            int decoded = high * 16 + low;
            if (isUnreserved(decoded) || decoded == '/' || decoded == '\\' || decoded == '.' || decoded == ';') {
                return true;
            }
            i += 2;
        }
        return false;
    }

    private static boolean isUnreserved(int c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
                || c == '-' || c == '_' || c == '~';
    }
}
