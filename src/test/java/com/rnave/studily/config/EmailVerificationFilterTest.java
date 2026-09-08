package com.rnave.studily.config;

import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailVerificationFilterTest {

    private UserRepository userRepository;
    private EmailVerificationFilter filter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        filter = new EmailVerificationFilter(userRepository);
        filterChain = mock(FilterChain.class);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAs(boolean verified) {
        User user = new User();
        user.setEmailVerified(verified);
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(7L, null, List.of()));
    }

    private HttpServletRequest requestFor(String uri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        return request;
    }

    @Test
    void parseEndpoint_isBlockedForUnverifiedUsers() throws Exception {
        authenticateAs(false);
        HttpServletResponse response = mock(HttpServletResponse.class);
        StringWriter body = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(body));

        filter.doFilter(requestFor("/api/courses/parse"), response, filterChain);

        verify(filterChain, never()).doFilter(any(), any());
        verify(response).setStatus(HttpServletResponse.SC_FORBIDDEN);
        assertThat(body.toString())
                .contains("EMAIL_UNVERIFIED")
                .contains(EmailVerificationFilter.PARSE_MESSAGE);
    }

    @Test
    void parseEndpoint_isAllowedForVerifiedUsers() throws Exception {
        authenticateAs(true);

        filter.doFilter(requestFor("/api/courses/parse"), mock(HttpServletResponse.class), filterChain);

        verify(filterChain, times(1)).doFilter(any(), any());
    }

    @Test
    void capabilityCheck_staysOpenSoTheUiCanExplainWhyItIsLocked() throws Exception {
        authenticateAs(false);

        filter.doFilter(requestFor("/api/courses/parse/enabled"),
                mock(HttpServletResponse.class), filterChain);

        verify(filterChain, times(1)).doFilter(any(), any());
    }

    @Test
    void ordinaryCourseEndpoints_areNotGated() throws Exception {
        authenticateAs(false);

        filter.doFilter(requestFor("/api/courses"), mock(HttpServletResponse.class), filterChain);
        filter.doFilter(requestFor("/api/courses/12"), mock(HttpServletResponse.class), filterChain);

        verify(filterChain, times(2)).doFilter(any(), any());
    }

    @Test
    void messagingRemainsGatedWithItsOwnMessage() throws Exception {
        authenticateAs(false);
        HttpServletResponse response = mock(HttpServletResponse.class);
        StringWriter body = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(body));

        filter.doFilter(requestFor("/api/conversations"), response, filterChain);

        verify(filterChain, never()).doFilter(any(), any());
        assertThat(body.toString()).contains(EmailVerificationFilter.MESSAGE);
    }

    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }
}
