CREATE TABLE flashcard_runs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    set_id BIGINT REFERENCES flashcard_sets(id) ON DELETE SET NULL,
    mode VARCHAR(16) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    local_date DATE NOT NULL,
    card_count INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    xp_awarded INT NOT NULL DEFAULT 0,
    xp_reason VARCHAR(16),
    results_json TEXT
);
CREATE INDEX idx_flashcard_runs_user_date ON flashcard_runs(user_id, local_date);
CREATE INDEX idx_flashcard_runs_user_started ON flashcard_runs(user_id, started_at);
