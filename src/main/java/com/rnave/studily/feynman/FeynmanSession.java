package com.rnave.studily.feynman;

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

@Entity
@Table(name = "feynman_sessions")
@Getter
@Setter
public class FeynmanSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "course_id")
    private Long courseId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 1000)
    private String focus;

    @Column(columnDefinition = "text")
    private String plan;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FeynmanStatus status = FeynmanStatus.ACTIVE;

    private Integer score;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
