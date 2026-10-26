CREATE TABLE school_feeds (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(16),
    host VARCHAR(255) NOT NULL,
    url_ciphertext TEXT NOT NULL,
    url_hash CHAR(64) NOT NULL,
    semester_id BIGINT REFERENCES semesters(id) ON DELETE SET NULL,
    time_zone VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_success_at TIMESTAMPTZ,
    last_error VARCHAR(200),
    failure_count INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_school_feeds_user_hash UNIQUE (user_id, url_hash)
);

CREATE INDEX idx_school_feeds_due ON school_feeds (last_synced_at) WHERE enabled;
