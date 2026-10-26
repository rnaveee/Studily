ALTER TABLE calendar_events
    ADD COLUMN course_id BIGINT REFERENCES courses (id) ON DELETE SET NULL;

CREATE INDEX idx_calendar_events_course ON calendar_events (course_id);
