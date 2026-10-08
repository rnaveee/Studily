package com.rnave.studily.studysession;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "study_session_blocks")
@Getter
@Setter
public class StudySessionBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private StudySession session;

    @Column(nullable = false)
    private int blockIndex;

    @Column(nullable = false)
    private Instant startedAt;

    @Column(nullable = false)
    private Instant dueAt;

    private Instant notifiedAt;

    private Instant confirmedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StudyBlockStatus status;

    @Column(nullable = false)
    private int creditedMinutes = 0;

    @Column(nullable = false)
    private int xpAwarded = 0;
}
