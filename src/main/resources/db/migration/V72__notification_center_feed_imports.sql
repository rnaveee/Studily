ALTER TABLE notifications ADD COLUMN title VARCHAR(160);
ALTER TABLE notifications ADD COLUMN url VARCHAR(500);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'DEADLINE_REMINDER',
        'CLASS_REMINDER',
        'EVENT_TODAY',
        'ITEM_WEEK_AHEAD',
        'EXAM_TODAY',
        'EXAM_COUNTDOWN',
        'ANNOUNCEMENT',
        'FRIEND_REQUEST',
        'FEED_REVIEW'));

CREATE INDEX idx_notifications_user_read ON notifications (user_id, read);

CREATE TABLE feed_imports (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_id BIGINT REFERENCES school_feeds(id) ON DELETE SET NULL,
    provider VARCHAR(16),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT feed_imports_status_check CHECK (status IN ('PENDING', 'APPLIED', 'DISMISSED'))
);

CREATE UNIQUE INDEX ux_feed_imports_pending_feed ON feed_imports (feed_id) WHERE status = 'PENDING';
CREATE INDEX idx_feed_imports_user ON feed_imports (user_id, status);

CREATE TABLE feed_ignored_refs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL,
    ref VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT feed_ignored_refs_kind_check CHECK (kind IN ('COURSE', 'ITEM')),
    CONSTRAINT uq_feed_ignored_refs UNIQUE (user_id, kind, ref)
);
