package com.rnave.studily.parse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "course_parse_cache")
@Getter
@Setter
public class CourseParseCacheEntry {

    @Id
    @Column(name = "cache_key", length = 64)
    private String cacheKey;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String draft;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(name = "hit_count", nullable = false)
    private int hitCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
