package com.rnave.studily.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "user_progress")
@Getter
@Setter
public class UserProgress {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private long xp = 0;

    @Column(nullable = false)
    private int level = 1;

    @Column(nullable = false)
    private int coins = 0;

    @Column(nullable = false)
    private int streakCurrent = 0;

    @Column(nullable = false)
    private int streakBest = 0;

    private LocalDate streakLastDate;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
