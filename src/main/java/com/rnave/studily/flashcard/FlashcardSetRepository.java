package com.rnave.studily.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FlashcardSetRepository extends JpaRepository<FlashcardSet, Long> {

    List<FlashcardSet> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<FlashcardSet> findByUserIdAndCourseIdOrderByCreatedAtDesc(Long userId, Long courseId);

    List<FlashcardSet> findByUserIdAndVisibilityInOrderByCreatedAtDesc(Long userId,
                                                                        Collection<FlashcardSetVisibility> visibilities);

    List<FlashcardSet> findByUserIdAndFolderIdOrderByCreatedAtDesc(Long userId, Long folderId);

    @Modifying
    @Query("update FlashcardSet s set s.folder = null where s.folder.id = :folderId")
    int clearFolder(@Param("folderId") Long folderId);

    Optional<FlashcardSet> findByIdAndUserId(Long id, Long userId);
}
