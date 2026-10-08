ALTER TABLE user_progress ADD COLUMN progress_zone VARCHAR(64);
ALTER TABLE user_progress ADD COLUMN progress_zone_changed_at TIMESTAMPTZ;
ALTER TABLE chests ADD COLUMN local_date DATE;
CREATE INDEX idx_chests_user_source_date ON chests(user_id, source, local_date);
