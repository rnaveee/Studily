ALTER TABLE user_progress ADD COLUMN streak_lost INT NOT NULL DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN streak_lost_last_date DATE;

CREATE TABLE streak_restores (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restored_date DATE NOT NULL,
    used_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id, restored_date)
);
CREATE INDEX idx_streak_restores_user_used ON streak_restores(user_id, used_on);
