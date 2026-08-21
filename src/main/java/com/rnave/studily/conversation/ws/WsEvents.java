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

    public record MessageEditEvent(String type, MessageDto message) {
        public static MessageEditEvent of(MessageDto message) {
            return new MessageEditEvent("messageEdited", message);
        }
    }

    public record MessageDeleteEvent(String type, Long conversationId, Long messageId) {
        public static MessageDeleteEvent of(Long conversationId, Long messageId) {
            return new MessageDeleteEvent("messageDeleted", conversationId, messageId);
        }
    }

    public record ConversationClearedEvent(String type, Long conversationId) {
        public static ConversationClearedEvent of(Long conversationId) {
            return new ConversationClearedEvent("conversationCleared", conversationId);
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
