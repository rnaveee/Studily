package com.rnave.studily.conversation;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.conversation.ws.WsEvents;
import com.rnave.studily.conversation.ws.WsSessionRegistry;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.notification.NotificationPrefsService;
import com.rnave.studily.progress.FlairRepository;
import com.rnave.studily.push.WebPushSender;
import com.rnave.studily.user.Flairs;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConversationServiceModerationTest {

    private MessageRepository messageRepository;
    private WsSessionRegistry registry;
    private ConversationService service;
    private User sender;
    private User friend;
    private Conversation conv;

    @BeforeEach
    void setUp() {
        messageRepository = mock(MessageRepository.class);
        registry = mock(WsSessionRegistry.class);
        service = new ConversationService(mock(ConversationRepository.class),
                mock(ConversationMemberRepository.class), messageRepository,
                mock(MessageLikeRepository.class), mock(MessageAttachmentRepository.class),
                mock(AttachmentProcessor.class), mock(FriendRequestRepository.class), mock(UserRepository.class),
                mock(CurrentUser.class), registry, mock(NotificationPrefsService.class),
                mock(WebPushSender.class),
                new Flairs(mock(FlairRepository.class), Clock.systemUTC(), "https://badges.studily.ca/flairs/v1"));
        sender = user(1L);
        friend = user(2L);
        conv = new Conversation();
        conv.setId(10L);
        conv.setType(ConversationType.GROUP);
        for (User u : new User[]{sender, friend}) {
            ConversationMember m = new ConversationMember();
            m.setConversation(conv);
            m.setUser(u);
            conv.getMembers().add(m);
        }
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void tearDown() {
        TransactionSynchronizationManager.clearSynchronization();
    }

    @Test
    void moderatorDelete_deletesAndBroadcastsDeleteEvent() {
        Message m = message(100L, sender);
        when(messageRepository.findById(100L)).thenReturn(Optional.of(m));
        when(messageRepository.findTopByConversationIdOrderByIdDesc(10L)).thenReturn(Optional.empty());

        boolean deleted = service.deleteMessageAsModerator(100L, 1L);

        assertThat(deleted).isTrue();
        verify(messageRepository).delete(m);
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(registry).sendToUser(eq(1L), any(WsEvents.MessageDeleteEvent.class));
        verify(registry).sendToUser(eq(2L), any(WsEvents.MessageDeleteEvent.class));
    }

    @Test
    void moderatorDelete_senderMismatchIsBadRequest() {
        when(messageRepository.findById(100L)).thenReturn(Optional.of(message(100L, sender)));

        assertThatThrownBy(() -> service.deleteMessageAsModerator(100L, 2L))
                .isInstanceOf(BadRequestException.class);
        verify(messageRepository, never()).delete(any(Message.class));
    }

    @Test
    void moderatorDelete_missingMessageReturnsFalse() {
        when(messageRepository.findById(100L)).thenReturn(Optional.empty());

        assertThat(service.deleteMessageAsModerator(100L, 1L)).isFalse();
    }

    private Message message(Long id, User from) {
        Message m = new Message();
        m.setId(id);
        m.setConversation(conv);
        m.setSender(from);
        m.setBody("hi");
        return m;
    }

    private static User user(Long id) {
        User u = new User();
        u.setId(id);
        u.setUsername("u" + id);
        return u;
    }
}
