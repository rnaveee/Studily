CREATE TABLE survey_responses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    survey_key VARCHAR(32) NOT NULL,
    platform VARCHAR(16),
    standalone BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, survey_key)
);

CREATE TABLE survey_answers (
    id BIGSERIAL PRIMARY KEY,
    response_id BIGINT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    question VARCHAR(48) NOT NULL,
    item VARCHAR(48),
    value TEXT NOT NULL
);

CREATE INDEX idx_survey_answers_question ON survey_answers(question);
CREATE INDEX idx_survey_answers_response ON survey_answers(response_id);

INSERT INTO badges (code, category, title, description, image_key, price_coins, sort_order) VALUES
    ('feedback', 'SOCIAL', 'Feedback', 'Answered a Studily survey.', 'feedback.webp', NULL, 60);
