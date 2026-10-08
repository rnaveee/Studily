package com.rnave.studily.studysession;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface StudySessionBlockRepository extends JpaRepository<StudySessionBlock, Long> {

    Optional<StudySessionBlock> findBySessionIdAndBlockIndex(Long sessionId, int idx);

    List<StudySessionBlock> findBySessionIdOrderByBlockIndex(Long sessionId);

    List<StudySessionBlock> findByStatusAndDueAtBeforeAndNotifiedAtIsNull(StudyBlockStatus s, Instant t);

    List<StudySessionBlock> findByStatusAndDueAtBefore(StudyBlockStatus s, Instant t);
}
