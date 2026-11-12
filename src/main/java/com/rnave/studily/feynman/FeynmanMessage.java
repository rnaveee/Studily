package com.rnave.studily.feynman;

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
@Table(name = "feynman_messages")
@Getter
@Setter
public class FeynmanMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private FeynmanSession session;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private FeynmanRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private FeynmanKind kind = FeynmanKind.CHAT;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(length = 200)
    private String concept;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
