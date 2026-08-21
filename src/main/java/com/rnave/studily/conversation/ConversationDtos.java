package com.rnave.studily.conversation;

import com.rnave.studily.friend.FriendDtos.PublicUserDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
            boolean unread,
            Instant otherReadAt) {

        public static ConversationDto from(Conversation c, String lastMessage, boolean unread, Instant otherReadAt) {
            return new ConversationDto(
                    c.getId(), c.getType(), c.getName(),
                    c.getMembers().stream().map(m -> PublicUserDto.from(m.getUser())).toList(),
                    lastMessage, c.getLastMessageAt(), unread, otherReadAt);
        }
    }

    public record MessageDto(
            Long id,
            Long conversationId,
            PublicUserDto sender,
            String body,
            AttachmentDto attachment,
            Instant createdAt,
            Instant editedAt,
            int likeCount,
            boolean likedByMe) {

        public static MessageDto from(Message m) {
            return from(m, 0, false);
        }

        public static MessageDto from(Message m, int likeCount, boolean likedByMe) {
            return new MessageDto(
                    m.getId(), m.getConversation().getId(),
                    PublicUserDto.from(m.getSender()), m.getBody(),
                    AttachmentDto.from(m), m.getCreatedAt(), m.getEditedAt(),
                    likeCount, likedByMe);
        }
    }

    public record MessageLikeDto(
            Long conversationId,
            Long messageId,
            int likeCount,
            java.util.List<Long> likedBy) {
    }

    public record AttachmentDto(
            String filename,
            String contentType,
            long size,
            boolean image,
            Integer width,
            Integer height) {

        public static AttachmentDto from(Message m) {
            if (!m.hasAttachment()) {
                return null;
            }
            return new AttachmentDto(
                    m.getAttachmentFilename(), m.getAttachmentContentType(), m.getAttachmentSize(),
                    m.getAttachmentContentType().startsWith("image/"),
                    m.getAttachmentWidth(), m.getAttachmentHeight());
        }
    }

    public record OpenDirectRequest(@NotNull Long userId) {
    }

    public record CreateGroupRequest(
            @NotBlank @Size(max = 100) String name,
            @NotEmpty @Size(max = 100) List<Long> memberIds) {
    }

    public record SendMessageRequest(@NotBlank @Size(max = 5000) String body) {
    }

    public record EditMessageRequest(@NotBlank @Size(max = 5000) String body) {
    }
}
