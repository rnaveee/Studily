ALTER TABLE study_sessions ADD COLUMN user_paused_at TIMESTAMPTZ;
CREATE INDEX idx_study_sessions_user_paused ON study_sessions(user_paused_at) WHERE user_paused_at IS NOT NULL;
