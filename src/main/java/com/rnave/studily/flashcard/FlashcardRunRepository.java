package com.rnave.studily.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;

public interface FlashcardRunRepository extends JpaRepository<FlashcardRun, Long> {

    Optional<FlashcardRun> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndStartedAtAfter(Long userId, Instant after);

    long countByUserIdAndSetIdAndLocalDateAndCompletedAtIsNotNull(Long userId, Long setId, LocalDate d);

    long countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(Long userId, Long setId, LocalDate d, int min);

    @Query("""
            select coalesce(sum(r.xpAwarded), 0) from FlashcardRun r
            where r.user.id = :userId and r.localDate = :d
            """)
    int sumXpByUserIdAndLocalDate(@Param("userId") Long userId, @Param("d") LocalDate d);

    long countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqual(Long userId, int min);

    long countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqualAndXpReasonNotIn(Long userId, int min,
                                                                                        Collection<String> reasons);
}
