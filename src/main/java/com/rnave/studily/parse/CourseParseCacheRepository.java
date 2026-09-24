package com.rnave.studily.parse;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

public interface CourseParseCacheRepository extends JpaRepository<CourseParseCacheEntry, String> {

    Optional<CourseParseCacheEntry> findByCacheKeyAndCreatedAtAfter(String cacheKey, Instant after);

    @Modifying
    @Transactional
    @Query("UPDATE CourseParseCacheEntry e SET e.hitCount = e.hitCount + 1 WHERE e.cacheKey = :key")
    void recordHit(@Param("key") String key);

    @Modifying
    @Transactional
    @Query("DELETE FROM CourseParseCacheEntry e WHERE e.createdAt < :before")
    int deleteOlderThan(@Param("before") Instant before);

    @Query("SELECT COALESCE(SUM(e.hitCount), 0) FROM CourseParseCacheEntry e")
    long totalHits();
}
