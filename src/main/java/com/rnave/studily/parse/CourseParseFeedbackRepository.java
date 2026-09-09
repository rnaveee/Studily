package com.rnave.studily.parse;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface CourseParseFeedbackRepository extends JpaRepository<CourseParseFeedback, Long> {

    boolean existsByParseId(Long parseId);

    long countByCreatedAtAfter(Instant since);

    long countByRatingNotAndCreatedAtAfter(ParseRating rating, Instant since);
}
