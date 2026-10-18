package com.rnave.studily.parse;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface CourseParseUsageRepository extends JpaRepository<CourseParseUsage, Long> {

    long countByUserIdAndFeatureAndSucceededTrueAndCreatedAtGreaterThanEqual(
            Long userId, AiFeature feature, Instant since);

    @Query("SELECT u.model AS model, SUM(u.inputTokens) AS inputTokens, SUM(u.outputTokens) AS outputTokens "
            + "FROM CourseParseUsage u WHERE u.feature = :feature AND u.createdAt >= :since GROUP BY u.model")
    List<ModelSpend> spendSince(@Param("since") Instant since, @Param("feature") AiFeature feature);

    interface ModelSpend {
        String getModel();

        Long getInputTokens();

        Long getOutputTokens();
    }
}
