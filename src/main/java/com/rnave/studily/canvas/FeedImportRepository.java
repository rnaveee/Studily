package com.rnave.studily.canvas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FeedImportRepository extends JpaRepository<FeedImport, Long> {

    Optional<FeedImport> findByIdAndUserId(Long id, Long userId);

    Optional<FeedImport> findFirstByFeedIdAndStatus(Long feedId, FeedImport.Status status);
}
