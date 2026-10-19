package com.rnave.studily.conversation;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.PageResponse;
import com.rnave.studily.conversation.ConversationDtos.MessageDto;
import com.rnave.studily.conversation.ws.WsSessionRegistry;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.notification.NotificationPrefsService;
import com.rnave.studily.push.WebPushSender;
import com.rnave.studily.progress.FlairRepository;
import com.rnave.studily.user.Flairs;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.SliceImpl;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConversationServiceReplyTest {

    private ConversationRepository conversationRepository;
    private ConversationMemberRepository conversationMemberRepository;
    private MessageRepository messageRepository;
    private CurrentUser currentUser;
    private ConversationService service;

    private User me;
    private User friend;
    private Conversation conv;

    @BeforeEach
    void setUp() {
        conversationRepository = mock(ConversationRepository.class);
        conversationMemberRepository = mock(ConversationMemberRepository.class);
        messageRepository = mock(MessageRepository.class);
        currentUser = mock(CurrentUser.class);
        service = new ConversationService(conversationRepository, conversationMemberRepository, messageRepository,
                mock(MessageLikeRepository.class), mock(MessageAttachmentRepository.class),
                mock(AttachmentProcessor.class), mock(FriendRequestRepository.class), mock(UserRepository.class),
                currentUser, mock(WsSessionRegistry.class), mock(NotificationPrefsService.class),
                mock(WebPushSender.class),
                new Flairs(mock(FlairRepository.class), Clock.systemUTC(), "https://badges.studily.ca/flairs/v1"));

        me = user(1L, "me", "Me Student");
        friend = user(2L, "friend", "Friend Student");
        conv = conversation(10L, me, friend);

        when(currentUser.id()).thenReturn(me.getId());
        when(currentUser.entity()).thenReturn(me);
        when(conversationRepository.findById(10L)).thenReturn(Optional.of(conv));
        when(conversationMemberRepository.existsByConversationIdAndUserId(10L, me.getId())).thenReturn(true);
        when(conversationMemberRepository.findByConversationIdAndUserId(anyLong(), anyLong()))
                .thenReturn(Optional.empty());
        when(messageRepository.save(any(Message.class))).thenAnswer(inv -> {
            Message m = inv.getArgument(0);
            m.setId(500L);
            return m;
        });
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void tearDown() {
        TransactionSynchronizationManager.clearSynchronization();
    }

    @Test
    void send_withReplyTarget_savesParentAndReturnsPreview() {
        Message parent = message(100L, conv, friend, "Are we still meeting at the library?");
        when(messageRepository.findById(100L)).thenReturn(Optional.of(parent));

        MessageDto dto = service.send(10L, "Yes, at 3", 100L);

        assertThat(dto.replyTo()).isNotNull();
        assertThat(dto.replyTo().id()).isEqualTo(100L);
        assertThat(dto.replyTo().senderId()).isEqualTo(friend.getId());
        assertThat(dto.replyTo().senderName()).isEqualTo("Friend Student");
        assertThat(dto.replyTo().body()).isEqualTo("Are we still meeting at the library?");
        assertThat(dto.replyTo().deleted()).isFalse();
        verify(messageRepository).save(argThat(m -> Long.valueOf(100L).equals(m.getReplyToMessageId())));
    }

    @Test
    void send_withoutReplyTarget_hasNoReply() {
        MessageDto dto = service.send(10L, "Hi", null);

        assertThat(dto.replyTo()).isNull();
        verify(messageRepository, never()).findById(anyLong());
    }

    @Test
    void send_replyToMessageInAnotherChat_isRejected() {
        Conversation elsewhere = conversation(11L, friend, user(3L, "third", "Third Student"));
        when(messageRepository.findById(200L)).thenReturn(Optional.of(message(200L, elsewhere, friend, "secret")));

        assertThatThrownBy(() -> service.send(10L, "peek", 200L))
                .isInstanceOf(BadRequestException.class);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void send_replyToMissingMessage_isRejected() {
        when(messageRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.send(10L, "hello?", 404L))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void send_replyPreview_isCappedAt200Characters() {
        Message parent = message(100L, conv, friend, "x".repeat(450));
        when(messageRepository.findById(100L)).thenReturn(Optional.of(parent));

        MessageDto dto = service.send(10L, "long one", 100L);

        assertThat(dto.replyTo().body()).hasSize(200);
    }

    @Test
    void messages_replyToDeletedMessage_isMarkedDeleted() {
        Message reply = message(300L, conv, me, "replying");
        reply.setReplyToMessageId(299L);
        Message plain = message(301L, conv, friend, "no reply");
        when(messageRepository.findByConversationIdAndIdLessThanAndIdGreaterThanOrderByIdDesc(
                eq(10L), anyLong(), anyLong(), any()))
                .thenReturn(new SliceImpl<>(List.of(plain, reply)));
        when(messageRepository.findWithSenderByIdIn(any())).thenReturn(List.of());

        PageResponse<MessageDto> page = service.messages(10L, null, 30);

        MessageDto replyDto = page.items().stream().filter(m -> m.id() == 300L).findFirst().orElseThrow();
        MessageDto plainDto = page.items().stream().filter(m -> m.id() == 301L).findFirst().orElseThrow();
        assertThat(replyDto.replyTo().deleted()).isTrue();
        assertThat(replyDto.replyTo().id()).isEqualTo(299L);
        assertThat(replyDto.replyTo().body()).isNull();
        assertThat(plainDto.replyTo()).isNull();
    }

    @Test
    void messages_replyToLiveMessage_carriesPreview() {
        Message parent = message(298L, conv, friend, "📚 chapter 4");
        Message reply = message(300L, conv, me, "on it");
        reply.setReplyToMessageId(298L);
        when(messageRepository.findByConversationIdAndIdLessThanAndIdGreaterThanOrderByIdDesc(
                eq(10L), anyLong(), anyLong(), any()))
                .thenReturn(new SliceImpl<>(List.of(reply)));
        when(messageRepository.findWithSenderByIdIn(any())).thenReturn(List.of(parent));

        PageResponse<MessageDto> page = service.messages(10L, null, 30);

        assertThat(page.items().getFirst().replyTo().body()).isEqualTo("📚 chapter 4");
        assertThat(page.items().getFirst().replyTo().deleted()).isFalse();
    }

    private static User user(Long id, String username, String name) {
        User u = new User();
        u.setId(id);
        u.setUsername(username);
        u.setName(name);
        u.setSchool("SFU");
        return u;
    }

    private static Conversation conversation(Long id, User... members) {
        Conversation c = new Conversation();
        c.setId(id);
        c.setType(ConversationType.GROUP);
        c.setName("Study group");
        for (User u : members) {
            ConversationMember m = new ConversationMember();
            m.setConversation(c);
            m.setUser(u);
            c.getMembers().add(m);
        }
        return c;
    }

    private static Message message(Long id, Conversation c, User sender, String body) {
        Message m = new Message();
        m.setId(id);
        m.setConversation(c);
        m.setSender(sender);
        m.setBody(body);
        return m;
    }
}
