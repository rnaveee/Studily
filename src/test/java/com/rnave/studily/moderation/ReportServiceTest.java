package com.rnave.studily.moderation;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.conversation.Conversation;
import com.rnave.studily.conversation.ConversationMemberRepository;
import com.rnave.studily.conversation.Message;
import com.rnave.studily.conversation.MessageAttachment;
import com.rnave.studily.conversation.MessageAttachmentRepository;
import com.rnave.studily.conversation.MessageRepository;
import com.rnave.studily.moderation.ReportController.CreateReportRequest;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReportServiceTest {

    private ReportRepository reports;
    private ReportEvidenceRepository evidence;
    private UserRepository users;
    private MessageRepository messages;
    private MessageAttachmentRepository attachments;
    private ConversationMemberRepository members;
    private CurrentUser currentUser;
    private ReportService service;
    private User me;
    private User target;

    @BeforeEach
    void setUp() {
        reports = mock(ReportRepository.class);
        evidence = mock(ReportEvidenceRepository.class);
        users = mock(UserRepository.class);
        messages = mock(MessageRepository.class);
        attachments = mock(MessageAttachmentRepository.class);
        members = mock(ConversationMemberRepository.class);
        currentUser = mock(CurrentUser.class);
        service = new ReportService(reports, evidence, users, messages, attachments, members, currentUser);
        me = user(1L, "me");
        target = user(2L, "target");
        target.setName("Real Name");
        target.setBio("real bio");
        when(currentUser.entity()).thenReturn(me);
        when(users.findById(2L)).thenReturn(Optional.of(target));
        when(reports.save(any(Report.class))).thenAnswer(inv -> {
            Report r = inv.getArgument(0);
            r.setId(50L);
            return r;
        });
    }

    private static CreateReportRequest userReq(Long userId, ReportReason reason, String details) {
        return new CreateReportRequest(ReportKind.USER, userId, null, reason, details);
    }

    private static CreateReportRequest messageReq(Long messageId, ReportReason reason, String details) {
        return new CreateReportRequest(ReportKind.MESSAGE, null, messageId, reason, details);
    }

    @Test
    void userReport_snapshotsFromDatabaseEntity() {
        service.create(userReq(2L, ReportReason.HARASSMENT, "  rude  "));

        ArgumentCaptor<Report> captor = ArgumentCaptor.forClass(Report.class);
        verify(reports).save(captor.capture());
        Report r = captor.getValue();
        assertThat(r.getReporterId()).isEqualTo(1L);
        assertThat(r.getReporterUsername()).isEqualTo("me");
        assertThat(r.getTargetUserId()).isEqualTo(2L);
        assertThat(r.getTargetUsername()).isEqualTo("target");
        assertThat(r.getTargetName()).isEqualTo("Real Name");
        assertThat(r.getTargetBio()).isEqualTo("real bio");
        assertThat(r.getDetails()).isEqualTo("rude");
        assertThat(r.getStatus()).isEqualTo(ReportStatus.OPEN);
        verify(users, never()).save(any(User.class));
    }

    @Test
    void selfReportRejected() {
        assertThatThrownBy(() -> service.create(userReq(1L, ReportReason.SPAM, null)))
                .isInstanceOf(BadRequestException.class);
        verify(reports, never()).save(any(Report.class));
    }

    @Test
    void unknownUserIs404() {
        assertThatThrownBy(() -> service.create(userReq(99L, ReportReason.SPAM, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void otherRequiresDetails() {
        assertThatThrownBy(() -> service.create(userReq(2L, ReportReason.OTHER, "   ")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(userReq(2L, ReportReason.OTHER, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void avatarReasonNotAllowedOnMessages() {
        assertThatThrownBy(() -> service.create(messageReq(100L, ReportReason.INAPPROPRIATE_AVATAR, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void contentReasonNotAllowedOnUsers() {
        assertThatThrownBy(() -> service.create(userReq(2L, ReportReason.INAPPROPRIATE_CONTENT, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void duplicateOpenUserReportIsNoop() {
        when(reports.existsByReporterIdAndTargetUserIdAndReasonAndStatusAndKind(
                1L, 2L, ReportReason.SPAM, ReportStatus.OPEN, ReportKind.USER)).thenReturn(true);

        service.create(userReq(2L, ReportReason.SPAM, null));

        verify(reports, never()).save(any(Report.class));
    }

    @Test
    void avatarReportCopiesAvatarEvidence() {
        target.setAvatarImage(new byte[]{1, 2, 3});
        target.setAvatarContentType("image/jpeg");

        service.create(userReq(2L, ReportReason.INAPPROPRIATE_AVATAR, null));

        ArgumentCaptor<ReportEvidence> captor = ArgumentCaptor.forClass(ReportEvidence.class);
        verify(evidence).save(captor.capture());
        assertThat(captor.getValue().getReportId()).isEqualTo(50L);
        assertThat(captor.getValue().getContentType()).isEqualTo("image/jpeg");
        assertThat(captor.getValue().getData()).containsExactly(1, 2, 3);
    }

    @Test
    void messageReport_snapshotsMessageAndCopiesImageEvidence() {
        Message m = message(100L, target);
        m.setAttachmentFilename("pic.png");
        m.setAttachmentContentType("image/png");
        m.setAttachmentSize(1000L);
        MessageAttachment blob = new MessageAttachment();
        blob.setMessageId(100L);
        blob.setData(new byte[]{9, 9});
        when(attachments.findById(100L)).thenReturn(Optional.of(blob));

        service.create(messageReq(100L, ReportReason.HARASSMENT, null));

        ArgumentCaptor<Report> captor = ArgumentCaptor.forClass(Report.class);
        verify(reports).save(captor.capture());
        Report r = captor.getValue();
        assertThat(r.getKind()).isEqualTo(ReportKind.MESSAGE);
        assertThat(r.getTargetUserId()).isEqualTo(2L);
        assertThat(r.getMessageId()).isEqualTo(100L);
        assertThat(r.getConversationId()).isEqualTo(10L);
        assertThat(r.getMessageBody()).isEqualTo("nasty words");
        assertThat(r.getMessageAttachmentFilename()).isEqualTo("pic.png");
        ArgumentCaptor<ReportEvidence> ev = ArgumentCaptor.forClass(ReportEvidence.class);
        verify(evidence).save(ev.capture());
        assertThat(ev.getValue().getData()).containsExactly(9, 9);
    }

    @Test
    void oversizedImageAttachmentIsNotCopied() {
        Message m = message(100L, target);
        m.setAttachmentFilename("pic.png");
        m.setAttachmentContentType("image/png");
        m.setAttachmentSize(6L * 1024 * 1024);

        service.create(messageReq(100L, ReportReason.HARASSMENT, null));

        verify(evidence, never()).save(any(ReportEvidence.class));
    }

    @Test
    void nonMemberGetsSame404AsMissingMessage() {
        message(100L, target);
        when(members.existsByConversationIdAndUserId(10L, 1L)).thenReturn(false);

        assertThatThrownBy(() -> service.create(messageReq(100L, ReportReason.SPAM, null)))
                .isInstanceOf(NotFoundException.class).hasMessage("Message not found");
        assertThatThrownBy(() -> service.create(messageReq(404L, ReportReason.SPAM, null)))
                .isInstanceOf(NotFoundException.class).hasMessage("Message not found");
        verify(reports, never()).save(any(Report.class));
    }

    @Test
    void ownMessageRejected() {
        message(100L, me);

        assertThatThrownBy(() -> service.create(messageReq(100L, ReportReason.SPAM, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void duplicateOpenMessageReportIsNoop() {
        message(100L, target);
        when(reports.existsByReporterIdAndMessageIdAndStatus(1L, 100L, ReportStatus.OPEN)).thenReturn(true);

        service.create(messageReq(100L, ReportReason.SPAM, null));

        verify(reports, never()).save(any(Report.class));
    }

    private Message message(Long id, User sender) {
        Conversation c = new Conversation();
        c.setId(10L);
        Message m = new Message();
        m.setId(id);
        m.setConversation(c);
        m.setSender(sender);
        m.setBody("nasty words");
        m.setCreatedAt(Instant.parse("2026-10-19T00:00:00Z"));
        when(messages.findById(id)).thenReturn(Optional.of(m));
        when(members.existsByConversationIdAndUserId(10L, 1L)).thenReturn(true);
        return m;
    }

    private static User user(Long id, String username) {
        User u = new User();
        u.setId(id);
        u.setUsername(username);
        return u;
    }
}
