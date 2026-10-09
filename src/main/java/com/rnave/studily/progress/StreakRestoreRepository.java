package com.rnave.studily.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface StreakRestoreRepository extends JpaRepository<StreakRestore, Long> {

    long countByUserIdAndUsedOnBetween(Long userId, LocalDate from, LocalDate to);

    @Query("select r.restoredDate from StreakRestore r "
            + "where r.user.id = :userId and r.restoredDate between :from and :to")
    List<LocalDate> restoredDates(@Param("userId") Long userId, @Param("from") LocalDate from,
                                  @Param("to") LocalDate to);
}
