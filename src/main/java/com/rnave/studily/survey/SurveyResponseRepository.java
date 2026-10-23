package com.rnave.studily.survey;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SurveyResponseRepository extends JpaRepository<SurveyResponse, Long> {

    boolean existsByUserIdAndSurveyKey(Long userId, String surveyKey);
}
