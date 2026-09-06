ALTER TABLE users ADD COLUMN schedule_visibility VARCHAR(20) NOT NULL DEFAULT 'FRIENDS';

ALTER TABLE users ADD CONSTRAINT users_schedule_visibility_check
    CHECK (schedule_visibility IN ('PUBLIC', 'FRIENDS', 'PRIVATE'));
