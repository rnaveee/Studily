package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ChestRepository extends JpaRepository<Chest, Long> {

    List<Chest> findByUserIdAndOpenedAtIsNullOrderByCreatedAt(Long userId);

    Optional<Chest> findByIdAndUserId(Long id, Long userId);

    @Modifying
    @Query("update Chest c set c.openedAt = :at where c.id = :id and c.user.id = :userId and c.openedAt is null")
    int markOpened(@Param("id") Long id, @Param("userId") Long userId, @Param("at") Instant at);

    boolean existsByUserIdAndSourceAndSourceRef(Long userId, ChestSource source, String sourceRef);

    long countByUserIdAndSourceAndCreatedAtBetween(Long userId, ChestSource source, Instant from, Instant to);

    long countByUserIdAndOpenedAtIsNull(Long userId);
}
