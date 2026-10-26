package com.rnave.studily.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FlashcardFolderRepository extends JpaRepository<FlashcardFolder, Long> {

    List<FlashcardFolder> findByUserIdOrderByPositionAscIdAsc(Long userId);

    Optional<FlashcardFolder> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    boolean existsByUserIdAndNameIgnoreCase(Long userId, String name);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(Long userId, String name, Long id);

    @Query("""
            select s.folder.id, count(s) from FlashcardSet s
            where s.user.id = :userId and s.folder is not null
            group by s.folder.id
            """)
    List<Object[]> setCounts(@Param("userId") Long userId);
}
