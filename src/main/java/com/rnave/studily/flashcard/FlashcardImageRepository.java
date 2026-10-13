package com.rnave.studily.flashcard;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FlashcardImageRepository extends JpaRepository<FlashcardImage, Long> {

    Optional<FlashcardImage> findByImageKey(String imageKey);

    List<FlashcardImage> findByImageKeyIn(Collection<String> imageKeys);

    @Query("select coalesce(sum(i.sizeBytes), 0) from FlashcardImage i where i.ownerId = :ownerId")
    long sumSizeBytesByOwnerId(@Param("ownerId") Long ownerId);

    @Modifying
    @Query(value = """
            delete from flashcard_images i
            where i.created_at < :cutoff
              and not exists (select 1 from flashcards f where f.front_image_key = i.image_key)
              and not exists (select 1 from flashcards f where f.back_image_key = i.image_key)
            """, nativeQuery = true)
    int deleteUnreferencedBefore(@Param("cutoff") Instant cutoff);
}
