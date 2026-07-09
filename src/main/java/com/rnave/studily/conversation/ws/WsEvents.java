package com.rnave.studily.conversation.ws;

import com.rnave.studily.conversation.ConversationDtos.MessageDto;

public final class WsEvents {

    private WsEvents() {}

    public record MessageEvent(String type, MessageDto message) {
        public static MessageEvent of(MessageDto message) {
            return new MessageEvent("message", message);
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
