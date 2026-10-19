package com.rnave.studily.moderation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "reports")
@Getter
@Setter
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ReportKind kind;

    @Column(name = "reporter_id")
    private Long reporterId;

    @Column(nullable = false)
    private String reporterUsername;

    @Column(name = "target_user_id")
    private Long targetUserId;

    @Column(nullable = false)
    private String targetUsername;

    private String targetName;

    @Column(length = 1000)
    private String targetBio;

    @Column(name = "message_id")
    private Long messageId;

    @Column(name = "conversation_id")
    private Long conversationId;

    @Column(columnDefinition = "text")
    private String messageBody;

    private String messageAttachmentFilename;

    @Column(length = 100)
    private String messageAttachmentContentType;

    private Instant messageCreatedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ReportReason reason;

    @Column(length = 1000)
    private String details;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ReportStatus status = ReportStatus.OPEN;

    @Column(name = "action_id")
    private Long actionId;

    private Instant resolvedAt;

    private String resolvedByName;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
