package com.rnave.studily.moderation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "banned_emails")
@Getter
@Setter
public class BannedEmail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email_hash", nullable = false, length = 64)
    private String emailHash;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
