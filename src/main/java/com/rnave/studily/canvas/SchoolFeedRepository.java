package com.rnave.studily.canvas;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SchoolFeedRepository extends JpaRepository<SchoolFeed, Long> {

    List<SchoolFeed> findByUserIdOrderByCreatedAtAsc(Long userId);

    Optional<SchoolFeed> findByIdAndUserId(Long id, Long userId);

    Optional<SchoolFeed> findByUserIdAndUrlHash(Long userId, String urlHash);

    long countByUserId(Long userId);

    @Query("select f.id from SchoolFeed f where f.enabled = true and f.lastSyncedAt < :cutoff "
            + "order by f.lastSyncedAt asc")
    List<Long> findDueIds(@Param("cutoff") Instant cutoff, Pageable pageable);
}
