ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ;

UPDATE users SET last_active_at = created_at;

CREATE INDEX idx_users_last_active ON users (last_active_at);
CREATE INDEX idx_users_created_at ON users (created_at);

CREATE TABLE admin_audit_log (
    id         BIGSERIAL PRIMARY KEY,
    actor_id   BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255) NOT NULL,
    action     VARCHAR(60)  NOT NULL,
    target     VARCHAR(255),
    detail     TEXT,
    ip         VARCHAR(64),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_created ON admin_audit_log (created_at DESC);
