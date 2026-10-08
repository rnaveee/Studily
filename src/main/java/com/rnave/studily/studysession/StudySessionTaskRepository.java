package com.rnave.studily.studysession;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StudySessionTaskRepository extends JpaRepository<StudySessionTask, Long> {

    List<StudySessionTask> findBySessionIdOrderByPosition(Long sessionId);

    Optional<StudySessionTask> findByIdAndSessionId(Long id, Long sessionId);

    @Query("""
            select count(t) from StudySessionTask t
            where t.session.user.id = :userId and t.session.localDate = :d and t.xpAwarded > 0
            """)
    long countPaidByUserIdAndLocalDate(@Param("userId") Long userId, @Param("d") LocalDate d);
}
