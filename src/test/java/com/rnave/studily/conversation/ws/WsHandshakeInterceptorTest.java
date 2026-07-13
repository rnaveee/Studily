package com.rnave.studily.conversation.ws;

import com.rnave.studily.config.JwtService;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WsHandshakeInterceptorTest {

    private JwtService jwtService;
    private UserRepository userRepository;
    private WsHandshakeInterceptor interceptor;
    private ServerHttpRequest request;
    private ServerHttpResponse response;
    private WebSocketHandler wsHandler;
    private Map<String, Object> attributes;

    @BeforeEach
    void setUp() {
        jwtService = mock(JwtService.class);
        userRepository = mock(UserRepository.class);
        interceptor = new WsHandshakeInterceptor(jwtService, userRepository);
        request = mock(ServerHttpRequest.class);
        response = mock(ServerHttpResponse.class);
        wsHandler = mock(WebSocketHandler.class);
        attributes = new HashMap<>();
    }

    @Test
    void validToken_acceptsAndStashesUserId() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/ws?token=good"));
        when(jwtService.parseToken("good")).thenReturn(new JwtService.TokenPayload(42L, 0));
        when(userRepository.findById(42L)).thenReturn(Optional.of(verifiedUserWithTokenVersion(0)));

        boolean accepted = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(accepted).isTrue();
        assertThat(attributes).containsEntry(WsHandshakeInterceptor.USER_ID_ATTR, 42L);
    }

    @Test
    void missingToken_rejectsWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/ws"));

        boolean accepted = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(accepted).isFalse();
        assertThat(attributes).isEmpty();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void invalidToken_rejectsWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/ws?token=garbage"));
        when(jwtService.parseToken("garbage")).thenThrow(new RuntimeException("bad signature"));

        boolean accepted = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(accepted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void staleTokenVersion_rejectsWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/ws?token=old"));
        when(jwtService.parseToken("old")).thenReturn(new JwtService.TokenPayload(42L, 0));
        when(userRepository.findById(42L)).thenReturn(Optional.of(verifiedUserWithTokenVersion(1)));

        boolean accepted = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(accepted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unverifiedEmail_rejectsWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/ws?token=good"));
        when(jwtService.parseToken("good")).thenReturn(new JwtService.TokenPayload(42L, 0));
        User unverified = verifiedUserWithTokenVersion(0);
        unverified.setEmailVerified(false);
        when(userRepository.findById(42L)).thenReturn(Optional.of(unverified));

        boolean accepted = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(accepted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void deletedUser_rejectsWith401() {
        when(request.getURI()).thenReturn(URI.create("ws://localhost/ws?token=orphan"));
        when(jwtService.parseToken("orphan")).thenReturn(new JwtService.TokenPayload(99L, 0));
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        boolean accepted = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(accepted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    private User verifiedUserWithTokenVersion(int version) {
        User user = new User();
        user.setTokenVersion(version);
        user.setEmailVerified(true);
        return user;
    }
}
