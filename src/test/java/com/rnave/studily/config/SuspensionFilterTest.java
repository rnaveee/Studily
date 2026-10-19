package com.rnave.studily.config;

import com.rnave.studily.admin.AdminGuard;
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
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SuspensionFilterTest {

    private static final Instant NOW = Instant.parse("2026-10-19T12:00:00Z");

    private UserRepository userRepository;
    private AdminGuard adminGuard;
    private SuspensionFilter filter;
    private FilterChain chain;
    private HttpServletResponse response;
    private StringWriter body;
    private User user;

    @BeforeEach
    void setUp() throws Exception {
        userRepository = mock(UserRepository.class);
        adminGuard = mock(AdminGuard.class);
        filter = new SuspensionFilter(userRepository, adminGuard, Clock.fixed(NOW, ZoneOffset.UTC));
        chain = mock(FilterChain.class);
        response = mock(HttpServletResponse.class);
        body = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(body));
        user = new User();
        user.setId(7L);
        user.setSuspendedUntil(NOW.plusSeconds(3600));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        authenticate();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(7L, null, List.of()));
    }

    private HttpServletRequest request(String method, String uri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn(method);
        when(request.getRequestURI()).thenReturn(uri);
        return request;
    }

    private boolean passes(String method, String uri) throws Exception {
        FilterChain local = mock(FilterChain.class);
        HttpServletRequest request = request(method, uri);
        filter.doFilterInternal(request, response, local);
        try {
            verify(local).doFilter(request, response);
            return true;
        } catch (AssertionError e) {
            return false;
        }
    }

    @Test
    void suspendedUser_isBlockedWithAccountSuspendedCode() throws Exception {
        HttpServletRequest request = request("GET", "/api/courses");

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(403);
        verify(chain, never()).doFilter(any(), any());
        assertThat(body.toString()).contains("\"code\":\"ACCOUNT_SUSPENDED\"");
    }

    @Test
    void allowListEntriesPass() throws Exception {
        assertThat(passes("POST", "/api/auth/login")).isTrue();
        assertThat(passes("GET", "/api/auth/anything")).isTrue();
        assertThat(passes("GET", "/api/public/sets/abc")).isTrue();
        assertThat(passes("GET", "/api/users/12/avatar")).isTrue();
        assertThat(passes("POST", "/api/push/rotate")).isTrue();
        assertThat(passes("POST", "/api/push/unsubscribe")).isTrue();
        assertThat(passes("POST", "/api/support")).isTrue();
        assertThat(passes("GET", "/api/me")).isTrue();
        assertThat(passes("GET", "/api/me/moderation")).isTrue();
        assertThat(passes("POST", "/api/me/token")).isTrue();
        assertThat(passes("POST", "/api/me/delete")).isTrue();
    }

    @Test
    void everythingElseIsBlocked() throws Exception {
        assertThat(passes("PUT", "/api/me")).isFalse();
        assertThat(passes("POST", "/api/me")).isFalse();
        assertThat(passes("HEAD", "/api/me")).isFalse();
        assertThat(passes("GET", "/api/me/delete")).isFalse();
        assertThat(passes("GET", "/api/authx")).isFalse();
        assertThat(passes("POST", "/api/authx/login")).isFalse();
        assertThat(passes("POST", "/api/supportx")).isFalse();
        assertThat(passes("POST", "/api/support/")).isFalse();
        assertThat(passes("GET", "/api/me/")).isFalse();
        assertThat(passes("POST", "/api/me/moderation/warnings/ack")).isFalse();
        assertThat(passes("POST", "/api/public/x")).isFalse();
        assertThat(passes("GET", "/api/users/12/avatar/x")).isFalse();
        assertThat(passes("GET", "/api/users/abc/avatar")).isFalse();
    }

    @Test
    void expiredSuspensionPasses() throws Exception {
        user.setSuspendedUntil(NOW.minusSeconds(1));

        assertThat(passes("GET", "/api/courses")).isTrue();
    }

    @Test
    void banBlocks() throws Exception {
        user.setSuspendedUntil(null);
        user.setBanned(true);

        assertThat(passes("GET", "/api/courses")).isFalse();
    }

    @Test
    void goodUserPasses() throws Exception {
        user.setSuspendedUntil(null);

        assertThat(passes("GET", "/api/courses")).isTrue();
    }

    @Test
    void unauthenticatedPassesWithoutLookup() throws Exception {
        SecurityContextHolder.clearContext();

        assertThat(passes("GET", "/api/courses")).isTrue();
        verifyNoInteractions(userRepository);
    }

    @Test
    void nonApiPathPasses() throws Exception {
        assertThat(passes("GET", "/assets/app.js")).isTrue();
    }

    @Test
    void adminIsNeverBlocked() throws Exception {
        when(adminGuard.isAdmin(user)).thenReturn(true);

        assertThat(passes("GET", "/api/courses")).isTrue();
    }

    @Test
    void stashedUserIsUsedWithoutRepositoryLookup() throws Exception {
        HttpServletRequest request = request("GET", "/api/courses");
        when(request.getAttribute(JwtAuthFilter.USER_ATTRIBUTE)).thenReturn(user);

        filter.doFilterInternal(request, response, chain);

        verify(chain, never()).doFilter(any(), any());
        verifyNoInteractions(userRepository);
    }
}
