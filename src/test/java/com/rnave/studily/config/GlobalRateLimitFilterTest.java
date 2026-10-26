package com.rnave.studily.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GlobalRateLimitFilterTest {

    private static final int LIMIT_PER_WINDOW = 120;

    private GlobalRateLimitFilter filter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new GlobalRateLimitFilter();
        filterChain = mock(FilterChain.class);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authPaths_areExemptSinceAuthRateLimitFilterAlreadyCoversThem() throws Exception {
        HttpServletRequest request = requestFor("/api/auth/login", "1.2.3.4");
        HttpServletResponse response = mock(HttpServletResponse.class);

        for (int i = 0; i < LIMIT_PER_WINDOW + 5; i++) {
            filter.doFilterInternal(request, response, filterChain);
        }

        verify(filterChain, times(LIMIT_PER_WINDOW + 5)).doFilter(request, response);
        verify(response, never()).setStatus(429);
    }

    @Test
    void nonApiPaths_bypassRateLimitingEntirely() throws Exception {
        HttpServletRequest request = requestFor("/index.html", "1.2.3.4");
        HttpServletResponse response = mock(HttpServletResponse.class);

        for (int i = 0; i < LIMIT_PER_WINDOW + 5; i++) {
            filter.doFilterInternal(request, response, filterChain);
        }

        verify(filterChain, times(LIMIT_PER_WINDOW + 5)).doFilter(request, response);
        verify(response, never()).setStatus(429);
    }

    @Test
    void apiPath_allowsUpToTheLimitThenReturns429() throws Exception {
        HttpServletRequest request = requestFor("/api/courses", "5.5.5.5");

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
    void flashcardImages_useTheirOwnLargerBucket() throws Exception {
        HttpServletRequest image = requestFor("/api/public/flashcard-images/abcdefghijklmnopqrstuv", "6.6.6.6");
        HttpServletRequest api = requestFor("/api/courses", "6.6.6.6");

        for (int i = 0; i < LIMIT_PER_WINDOW * 2; i++) {
            filter.doFilterInternal(image, mock(HttpServletResponse.class), filterChain);
        }
        HttpServletResponse apiResponse = mock(HttpServletResponse.class);
        filter.doFilterInternal(api, apiResponse, filterChain);

        verify(filterChain, times(LIMIT_PER_WINDOW * 2)).doFilter(eq(image), any());
        verify(filterChain).doFilter(api, apiResponse);
    }

    @Test
    void authenticatedRequests_areKeyedByUserIdNotIp() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(7L, null, List.of()));

        HttpServletRequest requestFromIpA = requestFor("/api/courses", "1.1.1.1");
        HttpServletRequest requestFromIpB = requestFor("/api/courses", "2.2.2.2");

        for (int i = 0; i < LIMIT_PER_WINDOW; i++) {
            filter.doFilterInternal(requestFromIpA, mock(HttpServletResponse.class), filterChain);
        }

        HttpServletResponse response = mock(HttpServletResponse.class);
        when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));

        filter.doFilterInternal(requestFromIpB, response, filterChain);

        verify(response).setStatus(429);
    }

    @Test
    void unauthenticatedRequests_getIndependentBucketsPerIp() throws Exception {
        HttpServletRequest exhausted = requestFor("/api/courses", "9.9.9.9");
        for (int i = 0; i < LIMIT_PER_WINDOW; i++) {
            filter.doFilterInternal(exhausted, mock(HttpServletResponse.class), filterChain);
        }

        HttpServletRequest freshIp = requestFor("/api/courses", "8.8.8.8");
        HttpServletResponse response = mock(HttpServletResponse.class);

        filter.doFilterInternal(freshIp, response, filterChain);

        verify(response, never()).setStatus(429);
        verify(filterChain).doFilter(freshIp, response);
    }

    @Test
    void calendarFeed_isKeyedPerTokenNotPerSharedIp() throws Exception {
        for (int i = 0; i < 30; i++) {
            filter.doFilterInternal(requestFor("/api/public/calendar/tokenA.ics", "64.233.0.1"),
                    mock(HttpServletResponse.class), filterChain);
        }
        HttpServletResponse blocked = mock(HttpServletResponse.class);
        when(blocked.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
        filter.doFilterInternal(requestFor("/api/public/calendar/tokenA.ics", "64.233.0.1"), blocked, filterChain);
        verify(blocked).setStatus(429);

        HttpServletRequest otherToken = requestFor("/api/public/calendar/tokenB.ics", "64.233.0.1");
        HttpServletResponse ok = mock(HttpServletResponse.class);
        filter.doFilterInternal(otherToken, ok, filterChain);
        verify(ok, never()).setStatus(429);
        verify(filterChain).doFilter(otherToken, ok);
    }

    @Test
    void calendarFeed_doesNotDrainTheAnonymousIpBucket() throws Exception {
        for (int i = 0; i < 100; i++) {
            filter.doFilterInternal(requestFor("/api/public/calendar/t" + i + ".ics", "17.0.0.1"),
                    mock(HttpServletResponse.class), filterChain);
        }
        HttpServletRequest api = requestFor("/api/courses", "17.0.0.1");
        HttpServletResponse response = mock(HttpServletResponse.class);
        filter.doFilterInternal(api, response, filterChain);
        verify(response, never()).setStatus(429);
        verify(filterChain).doFilter(api, response);
    }

    @Test
    void calendarFeed_floodOfRandomTokensFromOneIpIsStillBounded() throws Exception {
        for (int i = 0; i < 700; i++) {
            HttpServletResponse response = mock(HttpServletResponse.class);
            when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
            filter.doFilterInternal(requestFor("/api/public/calendar/rand" + i + ".ics", "99.1.1.1"),
                    response, filterChain);
        }
        verify(filterChain, times(600)).doFilter(any(), any());
    }

    @Test
    void feedToken_extractsTheTokenOnlyForFeedPaths() {
        org.assertj.core.api.Assertions.assertThat(GlobalRateLimitFilter.feedToken("/api/public/calendar/abc-_1.ics"))
                .isEqualTo("abc-_1");
        org.assertj.core.api.Assertions.assertThat(GlobalRateLimitFilter.feedToken("/api/courses")).isNull();
        org.assertj.core.api.Assertions.assertThat(GlobalRateLimitFilter.feedToken("/api/public/flashcard-images/x")).isNull();
    }

    private HttpServletRequest requestFor(String uri, String ip) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn(ip);
        return request;
    }
}
