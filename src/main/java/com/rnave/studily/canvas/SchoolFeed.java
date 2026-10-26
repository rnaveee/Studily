package com.rnave.studily.canvas;

import com.rnave.studily.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "school_feeds")
@Getter
@Setter
public class SchoolFeed {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 16)
    private String provider;

    @Column(nullable = false)
    private String host;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String urlCiphertext;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 64, columnDefinition = "CHAR(64)")
    private String urlHash;

    private Long semesterId;

    @Column(length = 64)
    private String timeZone;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant lastSyncedAt;

    private Instant lastSuccessAt;

    @Column(length = 200)
    private String lastError;

    @Column(nullable = false)
    private int failureCount;

    @Column(nullable = false)
    private boolean enabled = true;
}
