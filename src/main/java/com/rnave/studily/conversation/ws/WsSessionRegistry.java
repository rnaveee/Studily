package com.rnave.studily.conversation.ws;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WsSessionRegistry {

    private static final Logger log = LoggerFactory.getLogger(WsSessionRegistry.class);
    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int SEND_BUFFER_SIZE_BYTES = 512 * 1024;

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<Long, Map<String, WebSocketSession>> sessionsByUser =
            new ConcurrentHashMap<>();

    public WsSessionRegistry(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void register(Long userId, WebSocketSession session) {
        var decorated = new ConcurrentWebSocketSessionDecorator(
                session, SEND_TIME_LIMIT_MS, SEND_BUFFER_SIZE_BYTES);
        sessionsByUser.computeIfAbsent(userId, k -> new ConcurrentHashMap<>())
                .put(session.getId(), decorated);
    }

    public void remove(Long userId, WebSocketSession session) {
        sessionsByUser.computeIfPresent(userId, (k, sessions) -> {
            sessions.remove(session.getId());
            return sessions.isEmpty() ? null : sessions;
        });
    }

    public void sendToUser(Long userId, Object payload) {
        Map<String, WebSocketSession> sessions = sessionsByUser.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        TextMessage message = serialize(payload);
        for (WebSocketSession session : sessions.values()) {
            sendSafely(userId, session, message);
        }
    }

    public void sendToSession(Long userId, WebSocketSession rawSession, Object payload) {
        Map<String, WebSocketSession> sessions = sessionsByUser.get(userId);
        WebSocketSession decorated = sessions == null ? null : sessions.get(rawSession.getId());
        if (decorated != null) {
            sendSafely(userId, decorated, serialize(payload));
        }
    }

    private void sendSafely(Long userId, WebSocketSession session, TextMessage message) {
        try {
            if (session.isOpen()) {
                session.sendMessage(message);
            } else {
                remove(userId, session);
            }
        } catch (IOException | IllegalStateException ex) {
            log.debug("Dropping dead WebSocket session {} for user {}: {}",
                    session.getId(), userId, ex.getMessage());
            remove(userId, session);
        }
    }

    private TextMessage serialize(Object payload) {
        try {
            return new TextMessage(objectMapper.writeValueAsString(payload));
        } catch (JacksonException e) {
            throw new IllegalStateException("Could not serialize WebSocket payload", e);
        }
    }
}
