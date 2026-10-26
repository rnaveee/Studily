ALTER TABLE calendar_events ADD COLUMN feed_id BIGINT REFERENCES school_feeds(id) ON DELETE SET NULL;

CREATE INDEX idx_calendar_events_feed ON calendar_events (feed_id);
