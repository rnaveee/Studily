ALTER TABLE chests ADD COLUMN tier VARCHAR(16) NOT NULL DEFAULT 'SILVER';

ALTER TABLE study_sessions
    ADD COLUMN coins_awarded INT NOT NULL DEFAULT 0,
    ADD COLUMN chests_awarded INT NOT NULL DEFAULT 0;
CREATE INDEX idx_study_sessions_user_date_chests ON study_sessions(user_id, local_date) WHERE chests_awarded > 0;
