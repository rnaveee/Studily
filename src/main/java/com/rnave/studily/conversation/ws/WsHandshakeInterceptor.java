package com.rnave.studily.conversation.ws;

import com.rnave.studily.config.JwtService;
import com.rnave.studily.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Component
public class WsHandshakeInterceptor implements HandshakeInterceptor {

    public static final String USER_ID_ATTR = "userId";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public WsHandshakeInterceptor(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    public boolean beforeHandshake(@NonNull ServerHttpRequest request,
                                   @NonNull ServerHttpResponse response,
                                   @NonNull WebSocketHandler wsHandler,
                                   @NonNull Map<String, Object> attributes) {
        String token = UriComponentsBuilder.fromUri(request.getURI())
                .build().getQueryParams().getFirst("token");
        if (token == null || token.isBlank()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        try {
            JwtService.TokenPayload payload = jwtService.parseToken(token);
            boolean current = userRepository.findById(payload.userId())
                    .map(u -> u.getTokenVersion() == payload.tokenVersion() && u.isEmailVerified())
                    .orElse(false);
            if (!current) {
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return false;
            }
            attributes.put(USER_ID_ATTR, payload.userId());
            return true;
        } catch (Exception ex) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(@NonNull ServerHttpRequest request,
                               @NonNull ServerHttpResponse response,
                               @NonNull WebSocketHandler wsHandler,
                               Exception exception) {
    }
}
