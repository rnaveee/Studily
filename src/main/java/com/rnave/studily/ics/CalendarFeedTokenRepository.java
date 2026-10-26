package com.rnave.studily.ics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface CalendarFeedTokenRepository extends JpaRepository<CalendarFeedToken, Long> {

    Optional<CalendarFeedToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update CalendarFeedToken t set t.lastFetchedAt = :now "
            + "where t.userId = :userId and (t.lastFetchedAt is null or t.lastFetchedAt < :cutoff)")
    int touch(@Param("userId") Long userId, @Param("now") Instant now, @Param("cutoff") Instant cutoff);
}
