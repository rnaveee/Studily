package com.rnave.studily.moderation;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import java.util.List;

@Entity
@Table(name = "moderation_actions")
@Getter
@Setter
public class ModerationAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ModerationActionType type;

    @Convert(converter = ReportReasonsConverter.class)
    @Column(nullable = false)
    private List<ReportReason> reasons = List.of();

    @Column(length = 1000)
    private String note;

    private Instant endsAt;

    @Column(nullable = false)
    private boolean removedAvatar;

    @Column(nullable = false)
    private boolean clearedBio;

    @Column(nullable = false)
    private int deletedMessages;

    @Column(name = "created_by_id")
    private Long createdById;

    @Column(nullable = false)
    private String createdByName;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant acknowledgedAt;

    private Instant revokedAt;

    private String revokedByName;
}
