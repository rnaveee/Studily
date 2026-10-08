package com.rnave.studily.flashcard;

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

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "flashcard_runs")
@Getter
@Setter
public class FlashcardRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "set_id")
    private FlashcardSet set;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FlashcardRunMode mode;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant completedAt;

    @Column(nullable = false)
    private LocalDate localDate;

    @Column(nullable = false)
    private int cardCount = 0;

    @Column(nullable = false)
    private int correctCount = 0;

    @Column(nullable = false)
    private int xpAwarded = 0;

    @Column(length = 16)
    private String xpReason;

    @Column(columnDefinition = "text")
    private String resultsJson;
}
