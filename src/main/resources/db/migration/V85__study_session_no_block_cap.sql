ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_planned_blocks_check;
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_planned_minutes_check;
ALTER TABLE study_sessions ADD CONSTRAINT study_sessions_planned_blocks_check CHECK (planned_blocks >= 1);
ALTER TABLE study_sessions ADD CONSTRAINT study_sessions_planned_minutes_check CHECK (planned_minutes >= 25);
