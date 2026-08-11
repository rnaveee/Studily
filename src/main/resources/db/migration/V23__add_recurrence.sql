ALTER TABLE calendar_events ADD COLUMN series_id UUID;
ALTER TABLE calendar_events ADD COLUMN recurrence_rule VARCHAR(255);

ALTER TABLE academic_items ADD COLUMN series_id UUID;
ALTER TABLE academic_items ADD COLUMN recurrence_rule VARCHAR(255);

CREATE INDEX idx_calendar_events_series ON calendar_events (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX idx_academic_items_series ON academic_items (series_id) WHERE series_id IS NOT NULL;
