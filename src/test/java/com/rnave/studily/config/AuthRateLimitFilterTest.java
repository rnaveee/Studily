package com.rnave.studily.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthRateLimitFilterTest {

    private static final int LIMIT_PER_WINDOW = 10;

    private AuthRateLimitFilter filter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new AuthRateLimitFilter();
        filterChain = mock(FilterChain.class);
    }

    @Test
    void nonAuthPaths_bypassRateLimitingEntirely() throws Exception {
        HttpServletRequest request = requestFor("/api/courses", "1.2.3.4");
        HttpServletResponse response = mock(HttpServletResponse.class);

        for (int i = 0; i < LIMIT_PER_WINDOW + 5; i++) {
            filter.doFilterInternal(request, response, filterChain);
        }

        verify(filterChain, times(LIMIT_PER_WINDOW + 5)).doFilter(request, response);
        verify(response, never()).setStatus(429);
    }

    @Test
    void authPath_allowsUpToTheLimitThenReturns429() throws Exception {
        HttpServletRequest request = requestFor("/api/auth/login", "5.5.5.5");

        for (int i = 0; i < LIMIT_PER_WINDOW; i++) {
            HttpServletResponse response = mock(HttpServletResponse.class);
            filter.doFilterInternal(request, response, filterChain);
            verify(filterChain).doFilter(request, response);
        }

        HttpServletResponse blockedResponse = mock(HttpServletResponse.class);
        when(blockedResponse.getWriter()).thenReturn(new PrintWriter(new StringWriter()));

        filter.doFilterInternal(request, blockedResponse, filterChain);

        verify(blockedResponse).setStatus(429);
        verify(filterChain, never()).doFilter(request, blockedResponse);
    }

    @Test
    void differentIps_getIndependentRateLimitBuckets() throws Exception {
        HttpServletRequest exhausted = requestFor("/api/auth/login", "9.9.9.9");
        for (int i = 0; i < LIMIT_PER_WINDOW; i++) {
            filter.doFilterInternal(exhausted, mock(HttpServletResponse.class), filterChain);
        }

        HttpServletRequest freshIp = requestFor("/api/auth/login", "8.8.8.8");
        HttpServletResponse response = mock(HttpServletResponse.class);

        filter.doFilterInternal(freshIp, response, filterChain);

        verify(response, never()).setStatus(429);
        verify(filterChain).doFilter(freshIp, response);
    }

    @Test
    void usesTheLastXForwardedForEntryAsTheClientIpInsteadOfRemoteAddr() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn("3.3.3.3, 10.0.0.1");
        HttpServletResponse response = mock(HttpServletResponse.class);

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(request, never()).getRemoteAddr();
    }

    @Test
    void spoofedFirstXForwardedForEntriesCannotBypassTheLimit() throws Exception {
        for (int i = 0; i < LIMIT_PER_WINDOW; i++) {
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getRequestURI()).thenReturn("/api/auth/login");
            when(request.getHeader("X-Forwarded-For")).thenReturn("6.6.6." + i + ", 4.4.4.4");
            filter.doFilterInternal(request, mock(HttpServletResponse.class), filterChain);
        }

        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn("7.7.7.7, 4.4.4.4");
        HttpServletResponse blockedResponse = mock(HttpServletResponse.class);
        when(blockedResponse.getWriter()).thenReturn(new PrintWriter(new StringWriter()));

        filter.doFilterInternal(request, blockedResponse, filterChain);

        verify(blockedResponse).setStatus(429);
        verify(filterChain, never()).doFilter(request, blockedResponse);
    }

    private HttpServletRequest requestFor(String uri, String ip) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn(ip);
        return request;
    }
}
