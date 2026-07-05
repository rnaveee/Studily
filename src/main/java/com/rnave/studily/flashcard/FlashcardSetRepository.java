package com.rnave.studily.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FlashcardSetRepository extends JpaRepository<FlashcardSet, Long> {

    List<FlashcardSet> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<FlashcardSet> findByUserIdAndCourseIdOrderByCreatedAtDesc(Long userId, Long courseId);

    Optional<FlashcardSet> findByIdAndUserId(Long id, Long userId);
}
