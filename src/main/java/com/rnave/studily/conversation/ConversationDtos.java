package com.rnave.studily.conversation;

import com.rnave.studily.friend.FriendDtos.PublicUserDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

public class ConversationDtos {

    public record ConversationDto(
            Long id,
            ConversationType type,
            String name,
            List<PublicUserDto> members,
            String lastMessage,
            Instant lastMessageAt,
            boolean unread) {

        public static ConversationDto from(Conversation c, String lastMessage, boolean unread) {
            return new ConversationDto(
                    c.getId(), c.getType(), c.getName(),
                    c.getMembers().stream().map(m -> PublicUserDto.from(m.getUser())).toList(),
                    lastMessage, c.getLastMessageAt(), unread);
        }
    }

    public record MessageDto(
            Long id,
            Long conversationId,
            PublicUserDto sender,
            String body,
            Instant createdAt) {

        public static MessageDto from(Message m) {
            return new MessageDto(
                    m.getId(), m.getConversation().getId(),
                    PublicUserDto.from(m.getSender()), m.getBody(), m.getCreatedAt());
        }
    }

    public record OpenDirectRequest(@NotNull Long userId) {
    }

    public record CreateGroupRequest(@NotBlank String name, @NotEmpty List<Long> memberIds) {
    }

    public record SendMessageRequest(@NotBlank String body) {
    }
}
