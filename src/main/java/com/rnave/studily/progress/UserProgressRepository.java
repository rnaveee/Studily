package com.rnave.studily.progress;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserProgressRepository extends JpaRepository<UserProgress, Long> {

    @Modifying
    @Query(value = "INSERT INTO user_progress (user_id) VALUES (:userId) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertIfMissing(@Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from UserProgress p where p.userId = :userId")
    Optional<UserProgress> findForUpdate(@Param("userId") Long userId);
}
