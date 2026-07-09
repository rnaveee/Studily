package com.rnave.studily.conversation.ws;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.conversation.ConversationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.List;

@Component
public class MessageSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(MessageSocketHandler.class);
    private static final int MAX_BODY_LENGTH = 5000;
    private static final long RATE_WINDOW_MS = 60_000;

    private final ConversationService conversationService;
    private final WsSessionRegistry registry;
    private final ObjectMapper objectMapper;

    private final SlidingWindowRateLimiter sendLimiter =
            new SlidingWindowRateLimiter(120, RATE_WINDOW_MS);

    public MessageSocketHandler(ConversationService conversationService,
                                WsSessionRegistry registry,
                                ObjectMapper objectMapper) {
        this.conversationService = conversationService;
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        registry.register(userId(session), session);
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        registry.remove(userId(session), session);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        Long userId = userId(session);
        JsonNode frame;
        try {
            frame = objectMapper.readTree(message.getPayload());
        } catch (Exception e) {
            registry.sendToSession(userId, session, WsEvents.ErrorEvent.of("Malformed frame"));
            return;
        }
        String type = frame.path("type").asText("");
        switch (type) {
            case "ping" -> registry.sendToSession(userId, session, WsEvents.Pong.INSTANCE);
            case "send" -> handleSend(userId, session, frame);
            case "markRead" -> handleMarkRead(userId, session, frame);
            default -> registry.sendToSession(userId, session,
                    WsEvents.ErrorEvent.of("Unknown frame type: " + type));
        }
    }

    private void handleSend(Long userId, WebSocketSession session, JsonNode frame) {
        long conversationId = frame.path("conversationId").asLong(0);
        String body = frame.path("body").asText("").trim();
        if (conversationId <= 0 || body.isEmpty()) {
            registry.sendToSession(userId, session, WsEvents.ErrorEvent.of("Message can't be empty"));
            return;
        }
        if (body.length() > MAX_BODY_LENGTH) {
            registry.sendToSession(userId, session,
                    WsEvents.ErrorEvent.of("Message is too long (max " + MAX_BODY_LENGTH + " characters)"));
            return;
        }
        if (!sendLimiter.tryConsume("user:" + userId)) {
            registry.sendToSession(userId, session,
                    WsEvents.ErrorEvent.of("Too many messages, please slow down."));
            return;
        }

        dispatch(userId, session, () -> conversationService.send(conversationId, body));
    }

    private void handleMarkRead(Long userId, WebSocketSession session, JsonNode frame) {
        long conversationId = frame.path("conversationId").asLong(0);
        if (conversationId <= 0) {
            return;
        }
        dispatch(userId, session, () -> conversationService.markConversationRead(conversationId));
    }

    private void dispatch(Long userId, WebSocketSession session, Runnable action) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null, List.of()));
        try {
            action.run();
        } catch (NotFoundException | ForbiddenException | IllegalArgumentException ex) {
            registry.sendToSession(userId, session, WsEvents.ErrorEvent.of(ex.getMessage()));
        } catch (Exception ex) {
            log.error("WebSocket frame handling failed for user {}", userId, ex);
            registry.sendToSession(userId, session, WsEvents.ErrorEvent.of("Something went wrong"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private Long userId(WebSocketSession session) {
        return (Long) session.getAttributes().get(WsHandshakeInterceptor.USER_ID_ATTR);
    }

    @Scheduled(fixedRate = 10 * RATE_WINDOW_MS)
    void evictStaleRateLimitWindows() {
        sendLimiter.evictStale();
    }
}
