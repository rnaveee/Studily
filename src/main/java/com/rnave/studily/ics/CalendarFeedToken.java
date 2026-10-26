package com.rnave.studily.ics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "calendar_feed_tokens")
@Getter
@Setter
public class CalendarFeedToken {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant lastFetchedAt;
}
