package com.rnave.studily.canvas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeedIgnoredRefRepository extends JpaRepository<FeedIgnoredRef, Long> {

    List<FeedIgnoredRef> findByUserIdAndKind(Long userId, FeedIgnoredRef.Kind kind);

    boolean existsByUserIdAndKindAndRef(Long userId, FeedIgnoredRef.Kind kind, String ref);
}
