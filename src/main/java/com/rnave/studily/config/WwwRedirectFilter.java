package com.rnave.studily.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.util.Locale;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class WwwRedirectFilter extends OncePerRequestFilter {

    private final String canonicalOrigin;
    private final String wwwHost;

    public WwwRedirectFilter(@Value("${app.base-url}") String baseUrl) {
        URI base;
        try {
            base = URI.create(baseUrl.trim());
        } catch (RuntimeException e) {
            base = null;
        }
        String host = base == null || base.getHost() == null ? "" : base.getHost().toLowerCase(Locale.ROOT);
        boolean usable = !host.isEmpty() && !host.startsWith("www.") && base.getScheme() != null;
        this.canonicalOrigin = usable ? base.getScheme() + "://" + base.getRawAuthority() : null;
        this.wwwHost = usable ? "www." + host : null;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String host = request.getServerName();
        if (wwwHost == null || host == null || !wwwHost.equals(host.toLowerCase(Locale.ROOT))) {
            filterChain.doFilter(request, response);
            return;
        }

        String query = request.getQueryString();
        String target = canonicalOrigin + request.getRequestURI() + (query == null ? "" : "?" + query);
        String method = request.getMethod();
        boolean safe = "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method);
        response.setStatus(safe ? HttpServletResponse.SC_MOVED_PERMANENTLY : 308);
        response.setHeader(HttpHeaders.LOCATION, target);
    }
}
