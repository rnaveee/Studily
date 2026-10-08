package com.rnave.studily.studysession;

import com.rnave.studily.user.User;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "study_sessions")
@Getter
@Setter
public class StudySession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StudySessionMode mode;

    @Column(nullable = false)
    private int plannedBlocks;

    @Column(nullable = false)
    private int blockMinutes;

    @Column(nullable = false)
    private int breakMinutes;

    @Column(nullable = false)
    private int plannedMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StudySessionStatus status;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant endedAt;

    private Instant pausedAt;

    @Column(nullable = false)
    private LocalDate localDate;

    @Column(nullable = false)
    private int creditedMinutes = 0;

    @Column(nullable = false)
    private int xpAwarded = 0;

    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal multiplier = BigDecimal.ONE.setScale(2);

    @Column(nullable = false)
    private int currentBlock = 1;
}
