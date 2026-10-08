package com.rnave.studily.studysession;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudySessionTaskRepository extends JpaRepository<StudySessionTask, Long> {

    List<StudySessionTask> findBySessionIdOrderByPosition(Long sessionId);

    Optional<StudySessionTask> findByIdAndSessionId(Long id, Long sessionId);
}
