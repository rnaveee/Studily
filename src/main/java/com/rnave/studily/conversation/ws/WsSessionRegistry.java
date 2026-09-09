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
    private static final long PRESENCE_TTL_MS = 70_000;

    private static final class Connection {
        private final WebSocketSession session;
        private volatile boolean foreground = true;
        private volatile long lastHeardFrom = System.currentTimeMillis();

        private Connection(WebSocketSession session) {
            this.session = session;
        }

        private boolean isWatching(long now) {
            return foreground && session.isOpen() && now - lastHeardFrom <= PRESENCE_TTL_MS;
        }
    }

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<Long, Map<String, Connection>> sessionsByUser =
            new ConcurrentHashMap<>();

    public WsSessionRegistry(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void register(Long userId, WebSocketSession session) {
        var decorated = new ConcurrentWebSocketSessionDecorator(
                session, SEND_TIME_LIMIT_MS, SEND_BUFFER_SIZE_BYTES);
        sessionsByUser.computeIfAbsent(userId, k -> new ConcurrentHashMap<>())
                .put(session.getId(), new Connection(decorated));
    }

    public void remove(Long userId, String sessionId) {
        sessionsByUser.computeIfPresent(userId, (k, sessions) -> {
            sessions.remove(sessionId);
            return sessions.isEmpty() ? null : sessions;
        });
    }

    public void heardFrom(Long userId, String sessionId) {
        Connection connection = connection(userId, sessionId);
        if (connection != null) {
            connection.lastHeardFrom = System.currentTimeMillis();
        }
    }

    public void setForeground(Long userId, String sessionId, boolean foreground) {
        Connection connection = connection(userId, sessionId);
        if (connection != null) {
            connection.foreground = foreground;
            connection.lastHeardFrom = System.currentTimeMillis();
        }
    }

    public boolean isWatching(Long userId) {
        Map<String, Connection> sessions = sessionsByUser.get(userId);
        if (sessions == null) {
            return false;
        }
        long now = System.currentTimeMillis();
        return sessions.values().stream().anyMatch(c -> c.isWatching(now));
    }

    public void sendToUser(Long userId, Object payload) {
        Map<String, Connection> sessions = sessionsByUser.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        TextMessage message = serialize(payload);
        for (Connection connection : sessions.values()) {
            sendSafely(userId, connection, message);
        }
    }

    public void sendToSession(Long userId, String sessionId, Object payload) {
        Connection connection = connection(userId, sessionId);
        if (connection != null) {
            sendSafely(userId, connection, serialize(payload));
        }
    }

    private Connection connection(Long userId, String sessionId) {
        Map<String, Connection> sessions = sessionsByUser.get(userId);
        return sessions == null ? null : sessions.get(sessionId);
    }

    private void sendSafely(Long userId, Connection connection, TextMessage message) {
        WebSocketSession session = connection.session;
        try {
            if (session.isOpen()) {
                session.sendMessage(message);
            } else {
                remove(userId, session.getId());
            }
        } catch (IOException | IllegalStateException ex) {
            log.debug("Dropping dead WebSocket session {} for user {}: {}",
                    session.getId(), userId, ex.getMessage());
            remove(userId, session.getId());
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
