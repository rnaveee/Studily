CREATE TABLE push_subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE notification_prefs (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    messages        BOOLEAN NOT NULL DEFAULT TRUE,
    class_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    event_day_of    BOOLEAN NOT NULL DEFAULT TRUE,
    item_week_ahead BOOLEAN NOT NULL DEFAULT TRUE,
    exam_day_of     BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE notifications ADD COLUMN dedup_key VARCHAR(120);
CREATE UNIQUE INDEX ux_notifications_user_dedup
    ON notifications(user_id, dedup_key) WHERE dedup_key IS NOT NULL;
