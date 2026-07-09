package com.rnave.studily.conversation;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.PageResponse;
import com.rnave.studily.conversation.ConversationDtos.ConversationDto;
import com.rnave.studily.conversation.ConversationDtos.MessageDto;
import com.rnave.studily.conversation.ws.WsEvents;
import com.rnave.studily.conversation.ws.WsSessionRegistry;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.friend.FriendRequestStatus;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final MessageRepository messageRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;
    private final WsSessionRegistry wsSessionRegistry;

    public ConversationService(ConversationRepository conversationRepository,
                               ConversationMemberRepository conversationMemberRepository,
                               MessageRepository messageRepository,
                               FriendRequestRepository friendRequestRepository,
                               UserRepository userRepository,
                               CurrentUser currentUser,
                               WsSessionRegistry wsSessionRegistry) {
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.messageRepository = messageRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.wsSessionRegistry = wsSessionRegistry;
    }

    @Transactional(readOnly = true)
    public List<ConversationDto> list(ConversationType type) {
        Long me = currentUser.id();
        List<Conversation> conversations = type == null
                ? conversationRepository.findForUser(me)
                : conversationRepository.findForUserByType(me, type);
        return conversations.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ConversationDto get(Long id) {
        return toDto(requireMember(id));
    }

    @Transactional
    public ConversationDto openDirect(Long userId) {
        User me = currentUser.entity();
        if (userId.equals(me.getId())) {
            throw new IllegalArgumentException("You can't message yourself");
        }
        User other = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        requireFriends(me.getId(), other.getId());

        Conversation existing = conversationRepository.findDirectBetween(me.getId(), other.getId()).orElse(null);
        if (existing != null) {
            return toDto(existing);
        }

        Conversation conv = new Conversation();
        conv.setType(ConversationType.DIRECT);
        addMember(conv, me);
        addMember(conv, other);
        return toDto(conversationRepository.save(conv));
    }

    @Transactional
    public ConversationDto createGroup(String name, List<Long> memberIds) {
        User me = currentUser.entity();
        Set<Long> ids = new LinkedHashSet<>(memberIds);
        ids.remove(me.getId());
        if (ids.isEmpty()) {
            throw new IllegalArgumentException("A group needs at least one other member");
        }

        Conversation conv = new Conversation();
        conv.setType(ConversationType.GROUP);
        conv.setName(name.trim());
        addMember(conv, me);
        for (Long id : ids) {
            User member = userRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("User not found"));
            requireFriends(me.getId(), member.getId());
            addMember(conv, member);
        }
        return toDto(conversationRepository.save(conv));
    }

    @Transactional
    public PageResponse<MessageDto> messages(Long conversationId, Long before, int limit) {
        requireMember(conversationId);
        if (before == null) {
            markRead(conversationId);
        }
        int size = Math.min(Math.max(limit, 1), 100);
        Slice<Message> slice = before == null
                ? messageRepository.findByConversationIdOrderByIdDesc(conversationId, PageRequest.of(0, size))
                : messageRepository.findByConversationIdAndIdLessThanOrderByIdDesc(
                        conversationId, before, PageRequest.of(0, size));
        List<MessageDto> items = slice.getContent().reversed().stream().map(MessageDto::from).toList();
        return new PageResponse<>(items, slice.hasNext());
    }

    @Transactional
    public MessageDto send(Long conversationId, String body) {
        Conversation conv = requireMember(conversationId);
        if (conv.getType() == ConversationType.DIRECT) {
            Long me = currentUser.id();
            conv.getMembers().stream()
                    .map(m -> m.getUser().getId())
                    .filter(id -> !id.equals(me))
                    .findFirst()
                    .ifPresent(other -> requireFriends(me, other));
        }
        Message message = new Message();
        message.setConversation(conv);
        message.setSender(currentUser.entity());
        message.setBody(body.trim());
        conv.setLastMessageAt(Instant.now());
        MessageDto dto = MessageDto.from(messageRepository.save(message));
        broadcastAfterCommit(conv, dto);
        return dto;
    }

    @Transactional
    public void markConversationRead(Long conversationId) {
        requireMember(conversationId);
        markRead(conversationId);
    }

    private void broadcastAfterCommit(Conversation conv, MessageDto dto) {
        List<Long> memberIds = conv.getMembers().stream()
                .map(m -> m.getUser().getId())
                .toList();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (Long memberId : memberIds) {
                    wsSessionRegistry.sendToUser(memberId, WsEvents.MessageEvent.of(dto));
                }
            }
        });
    }

    private Conversation requireMember(Long conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!conversationMemberRepository.existsByConversationIdAndUserId(conversationId, currentUser.id())) {
            throw new NotFoundException("Conversation not found");
        }
        return conv;
    }

    private void markRead(Long conversationId) {
        conversationMemberRepository.findByConversationIdAndUserId(conversationId, currentUser.id())
                .ifPresent(m -> m.setLastReadAt(Instant.now()));
    }

    private void requireFriends(Long me, Long other) {
        boolean friends = friendRequestRepository.findBetween(me, other)
                .map(f -> f.getStatus() == FriendRequestStatus.ACCEPTED)
                .orElse(false);
        if (!friends) {
            throw new ForbiddenException("You can only message friends");
        }
    }

    private void addMember(Conversation conv, User user) {
        ConversationMember member = new ConversationMember();
        member.setConversation(conv);
        member.setUser(user);
        conv.getMembers().add(member);
    }

    private ConversationDto toDto(Conversation c) {
        String lastMessage = messageRepository.findTopByConversationIdOrderByCreatedAtDesc(c.getId())
                .map(Message::getBody)
                .orElse(null);
        return ConversationDto.from(c, lastMessage, isUnread(c));
    }

    private boolean isUnread(Conversation c) {
        if (c.getLastMessageAt() == null) {
            return false;
        }
        Long me = currentUser.id();
        Instant lastReadAt = c.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(me))
                .findFirst()
                .map(ConversationMember::getLastReadAt)
                .orElse(null);
        return messageRepository.existsByConversationIdAndSenderIdNotAndCreatedAtAfter(
                c.getId(), me, lastReadAt == null ? Instant.EPOCH : lastReadAt);
    }
}
