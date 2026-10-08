package com.rnave.studily.studysession;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudySessionRepository extends JpaRepository<StudySession, Long> {

    Optional<StudySession> findFirstByUserIdAndStatusIn(Long userId, Collection<StudySessionStatus> s);

    Optional<StudySession> findByIdAndUserId(Long id, Long userId);

    Slice<StudySession> findByUserIdOrderByStartedAtDesc(Long userId, Pageable p);

    @Query("""
            select coalesce(sum(s.creditedMinutes), 0) from StudySession s
            where s.user.id = :userId and s.localDate = :d
            """)
    int sumCreditedMinutesByUserIdAndLocalDate(@Param("userId") Long userId, @Param("d") LocalDate d);

    @Query("select coalesce(sum(s.creditedMinutes), 0) from StudySession s where s.user.id = :userId")
    long sumCreditedMinutesByUserId(@Param("userId") Long userId);

    List<StudySession> findByStatusAndPausedAtBefore(StudySessionStatus s, Instant t);

    @Query("""
            select s.localDate from StudySession s
            where s.user.id = :userId and s.localDate between :from and :to
            group by s.localDate
            having sum(s.creditedMinutes) >= :minMinutes
            order by s.localDate
            """)
    List<LocalDate> qualifiedDates(@Param("userId") Long userId,
                                   @Param("from") LocalDate from,
                                   @Param("to") LocalDate to,
                                   @Param("minMinutes") int minMinutes);

    boolean existsByUserIdAndStatus(Long userId, StudySessionStatus status);
}
