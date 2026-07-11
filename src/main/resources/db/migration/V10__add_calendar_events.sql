CREATE TABLE calendar_events (
    id       BIGSERIAL PRIMARY KEY,
    user_id  BIGINT       NOT NULL REFERENCES users(id),
    title    VARCHAR(255) NOT NULL,
    place    VARCHAR(255),
    start_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_calendar_events_user_start ON calendar_events(user_id, start_at);
