CREATE TABLE survey_prompt_views (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    survey_key VARCHAR(32) NOT NULL,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, survey_key)
);
