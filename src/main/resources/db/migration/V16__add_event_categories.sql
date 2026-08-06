CREATE TABLE event_categories (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(60) NOT NULL,
    color      VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_categories_user ON event_categories (user_id);
CREATE UNIQUE INDEX ux_event_categories_user_name ON event_categories (user_id, lower(name));

ALTER TABLE calendar_events
    ADD COLUMN category_id BIGINT REFERENCES event_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_calendar_events_category ON calendar_events (category_id);
