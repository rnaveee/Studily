package com.rnave.studily.flashcard;

import com.rnave.studily.user.User;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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
import java.util.HashSet;
import java.util.Set;

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

    @Column(name = "folder_id")
    private Long folderId;

    @Column(name = "course_id")
    private Long courseId;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "flashcard_run_sets", joinColumns = @JoinColumn(name = "run_id"))
    @Column(name = "set_id")
    private Set<Long> coveredSetIds = new HashSet<>();

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
