package com.rnave.studily.survey;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class SurveyPromptViews {

    private final JdbcTemplate jdbc;

    public SurveyPromptViews(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean seen(Long userId, String surveyKey) {
        Boolean seen = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM survey_prompt_views WHERE user_id = ? AND survey_key = ?)",
                Boolean.class, userId, surveyKey);
        return Boolean.TRUE.equals(seen);
    }

    public void markSeen(Long userId, String surveyKey) {
        jdbc.update("INSERT INTO survey_prompt_views (user_id, survey_key) VALUES (?, ?) ON CONFLICT DO NOTHING",
                userId, surveyKey);
    }
}
