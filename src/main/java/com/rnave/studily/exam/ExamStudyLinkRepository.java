package com.rnave.studily.exam;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ExamStudyLinkRepository extends JpaRepository<ExamStudyLink, Long> {

    List<ExamStudyLink> findByExamIdOrderByIdAsc(Long examId);

    List<ExamStudyLink> findByExamIdIn(Collection<Long> examIds);

    Optional<ExamStudyLink> findByIdAndExamId(Long id, Long examId);

    boolean existsByExamIdAndFlashcardSetId(Long examId, Long setId);

    boolean existsByExamIdAndTodoId(Long examId, Long todoId);

    @Query("""
            select min(l.exam.dueAt) from ExamStudyLink l
            where l.flashcardSet.id = :setId
              and l.exam.status <> com.rnave.studily.academic.ItemStatus.DONE
              and l.exam.dueAt > :now
            """)
    Optional<Instant> soonestExamForSet(@Param("setId") Long setId, @Param("now") Instant now);
}
