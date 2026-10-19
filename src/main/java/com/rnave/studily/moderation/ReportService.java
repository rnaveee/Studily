package com.rnave.studily.moderation;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.conversation.ConversationMemberRepository;
import com.rnave.studily.conversation.Message;
import com.rnave.studily.conversation.MessageAttachmentRepository;
import com.rnave.studily.conversation.MessageRepository;
import com.rnave.studily.moderation.ReportController.CreateReportRequest;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

    private static final long MAX_EVIDENCE_BYTES = 5L * 1024 * 1024;

    private final ReportRepository reportRepository;
    private final ReportEvidenceRepository evidenceRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final MessageAttachmentRepository attachmentRepository;
    private final ConversationMemberRepository memberRepository;
    private final CurrentUser currentUser;

    public ReportService(ReportRepository reportRepository, ReportEvidenceRepository evidenceRepository,
                         UserRepository userRepository, MessageRepository messageRepository,
                         MessageAttachmentRepository attachmentRepository,
                         ConversationMemberRepository memberRepository, CurrentUser currentUser) {
        this.reportRepository = reportRepository;
        this.evidenceRepository = evidenceRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.attachmentRepository = attachmentRepository;
        this.memberRepository = memberRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public void create(CreateReportRequest req) {
        User me = currentUser.entity();
        ReportKind kind = req.kind();
        ReportReason reason = req.reason();
        if (!reason.allowedFor(kind)) {
            throw new BadRequestException("Pick a reason");
        }
        String details = req.details() == null ? null : req.details().trim();
        if (details != null && details.isEmpty()) {
            details = null;
        }
        if (reason == ReportReason.OTHER && details == null) {
            throw new BadRequestException("Tell us what's wrong");
        }
        if (kind == ReportKind.USER) {
            createUserReport(me, req, reason, details);
        } else {
            createMessageReport(me, req, reason, details);
        }
    }

    private void createUserReport(User me, CreateReportRequest req, ReportReason reason, String details) {
        if (req.userId() == null) {
            throw new BadRequestException("Pick someone to report");
        }
        if (req.userId().equals(me.getId())) {
            throw new BadRequestException("You can't report yourself");
        }
        User target = userRepository.findById(req.userId())
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (reportRepository.existsByReporterIdAndTargetUserIdAndReasonAndStatusAndKind(
                me.getId(), target.getId(), reason, ReportStatus.OPEN, ReportKind.USER)) {
            return;
        }
        Report report = base(me, target, ReportKind.USER, reason, details);
        report = reportRepository.save(report);
        if (reason == ReportReason.INAPPROPRIATE_AVATAR && target.getAvatarImage() != null
                && target.getAvatarContentType() != null) {
            saveEvidence(report.getId(), target.getAvatarContentType(), target.getAvatarImage());
        }
    }

    private void createMessageReport(User me, CreateReportRequest req, ReportReason reason, String details) {
        if (req.messageId() == null) {
            throw new BadRequestException("Pick a message to report");
        }
        Message message = messageRepository.findById(req.messageId())
                .filter(m -> memberRepository.existsByConversationIdAndUserId(
                        m.getConversation().getId(), me.getId()))
                .orElseThrow(() -> new NotFoundException("Message not found"));
        User target = message.getSender();
        if (target.getId().equals(me.getId())) {
            throw new BadRequestException("You can't report your own message");
        }
        if (reportRepository.existsByReporterIdAndMessageIdAndStatus(
                me.getId(), message.getId(), ReportStatus.OPEN)) {
            return;
        }
        Report report = base(me, target, ReportKind.MESSAGE, reason, details);
        report.setMessageId(message.getId());
        report.setConversationId(message.getConversation().getId());
        report.setMessageBody(message.getBody());
        report.setMessageAttachmentFilename(message.getAttachmentFilename());
        report.setMessageAttachmentContentType(message.getAttachmentContentType());
        report.setMessageCreatedAt(message.getCreatedAt());
        report = reportRepository.save(report);
        String type = message.getAttachmentContentType();
        if (message.hasAttachment() && type != null && type.startsWith("image/")
                && message.getAttachmentSize() != null && message.getAttachmentSize() <= MAX_EVIDENCE_BYTES) {
            Long reportId = report.getId();
            attachmentRepository.findById(message.getId())
                    .ifPresent(blob -> saveEvidence(reportId, type, blob.getData()));
        }
    }

    private Report base(User me, User target, ReportKind kind, ReportReason reason, String details) {
        Report report = new Report();
        report.setKind(kind);
        report.setReporterId(me.getId());
        report.setReporterUsername(me.getUsername());
        report.setTargetUserId(target.getId());
        report.setTargetUsername(target.getUsername());
        report.setTargetName(target.getName());
        report.setTargetBio(target.getBio());
        report.setReason(reason);
        report.setDetails(details);
        return report;
    }

    private void saveEvidence(Long reportId, String contentType, byte[] data) {
        ReportEvidence evidence = new ReportEvidence();
        evidence.setReportId(reportId);
        evidence.setContentType(contentType);
        evidence.setData(data);
        evidenceRepository.save(evidence);
    }
}
