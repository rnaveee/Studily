package com.rnave.studily.progress;

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
@Table(name = "chests")
@Getter
@Setter
public class Chest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ChestSource source;

    @Column(nullable = false, length = 64)
    private String sourceRef;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant openedAt;

    private Integer lootCoins;

    private Integer lootXp;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "loot_badge_code")
    private Badge lootBadge;

    private LocalDate localDate;
}
