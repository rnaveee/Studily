package com.rnave.studily.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FlashcardRunRepository extends JpaRepository<FlashcardRun, Long> {

    Optional<FlashcardRun> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndStartedAtAfter(Long userId, Instant after);

    long countByUserIdAndSetIdAndLocalDateAndCompletedAtIsNotNull(Long userId, Long setId, LocalDate d);

    long countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(Long userId, Long setId, LocalDate d, int min);

    long countByUserIdAndFolderIdAndLocalDateAndXpAwardedGreaterThan(Long userId, Long folderId, LocalDate d,
                                                                      int min);

    long countByUserIdAndCourseIdAndLocalDateAndXpAwardedGreaterThan(Long userId, Long courseId, LocalDate d,
                                                                      int min);

    @Query("""
            select count(r) from FlashcardRun r
            where r.user.id = :userId and r.localDate = :d and r.xpAwarded > 0 and :setId member of r.coveredSetIds
            """)
    long countGroupRunsCovering(@Param("userId") Long userId, @Param("setId") Long setId, @Param("d") LocalDate d);

    @Query("""
            select s, count(r) from FlashcardRun r join r.coveredSetIds s
            where r.user.id = :userId and r.localDate = :d and r.xpAwarded > 0 and s in :ids
            group by s
            """)
    List<Object[]> countGroupRunsCoveringSets(@Param("userId") Long userId, @Param("ids") Collection<Long> ids,
                                              @Param("d") LocalDate d);

    @Query("""
            select r.set.id, count(r) from FlashcardRun r
            where r.user.id = :userId and r.localDate = :d and r.xpAwarded > 0 and r.set.id in :ids
            group by r.set.id
            """)
    List<Object[]> countSetRunsBySet(@Param("userId") Long userId, @Param("ids") Collection<Long> ids,
                                     @Param("d") LocalDate d);

    @Query("""
            select coalesce(sum(r.xpAwarded), 0) from FlashcardRun r
            where r.user.id = :userId and r.localDate = :d
            """)
    int sumXpByUserIdAndLocalDate(@Param("userId") Long userId, @Param("d") LocalDate d);

    long countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqual(Long userId, int min);

    long countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqualAndXpReasonNotIn(Long userId, int min,
                                                                                        Collection<String> reasons);
}
