package com.rnave.studily.conversation.ws;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.ObjectMapper;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WsSessionRegistryTest {

    @Test
    void closeAllForUser_closesEverySessionAndForgetsThem() throws Exception {
        WsSessionRegistry registry = new WsSessionRegistry(new ObjectMapper());
        WebSocketSession a = session("a");
        WebSocketSession b = session("b");
        WebSocketSession other = session("c");
        registry.register(1L, a);
        registry.register(1L, b);
        registry.register(2L, other);

        registry.closeAllForUser(1L, WsSessionRegistry.SUSPENDED);

        verify(a).close(WsSessionRegistry.SUSPENDED);
        verify(b).close(WsSessionRegistry.SUSPENDED);
        verify(other, never()).close(WsSessionRegistry.SUSPENDED);
        registry.sendToUser(1L, "ping");
        verify(a, never()).sendMessage(org.mockito.ArgumentMatchers.any());
        org.assertj.core.api.Assertions.assertThat(registry.isWatching(1L)).isFalse();
    }

    @Test
    void closeAllForUser_unknownUserIsNoop() {
        new WsSessionRegistry(new ObjectMapper()).closeAllForUser(99L, WsSessionRegistry.SUSPENDED);
    }

    @Test
    void suspendedStatusUsesCode4403() {
        org.assertj.core.api.Assertions.assertThat(WsSessionRegistry.SUSPENDED.getCode()).isEqualTo(4403);
    }

    private static WebSocketSession session(String id) {
        WebSocketSession s = mock(WebSocketSession.class);
        when(s.getId()).thenReturn(id);
        when(s.isOpen()).thenReturn(true);
        return s;
    }
}
