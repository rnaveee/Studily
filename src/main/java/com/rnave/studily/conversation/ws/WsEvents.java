package com.rnave.studily.conversation.ws;

import com.rnave.studily.conversation.ConversationDtos.MessageDto;
import com.rnave.studily.conversation.ConversationDtos.MessageLikeDto;

public final class WsEvents {

    private WsEvents() {}

    public record MessageEvent(String type, MessageDto message) {
        public static MessageEvent of(MessageDto message) {
            return new MessageEvent("message", message);
        }
    }

    public record MessageLikeEvent(String type, MessageLikeDto like) {
        public static MessageLikeEvent of(MessageLikeDto like) {
            return new MessageLikeEvent("like", like);
        }
    }

    public record ReadEvent(String type, Long conversationId, Long userId, java.time.Instant at) {
        public static ReadEvent of(Long conversationId, Long userId, java.time.Instant at) {
            return new ReadEvent("read", conversationId, userId, at);
        }
    }

    public record Pong(String type) {
        public static final Pong INSTANCE = new Pong("pong");
    }

    public record ErrorEvent(String type, String message) {
        public static ErrorEvent of(String message) {
            return new ErrorEvent("error", message);
        }
    }
}
