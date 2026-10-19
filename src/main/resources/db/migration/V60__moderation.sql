ALTER TABLE users ADD COLUMN suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN banned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD CONSTRAINT users_ban_shape CHECK (NOT banned OR suspended_until IS NULL);

CREATE TABLE moderation_actions (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username         VARCHAR(255) NOT NULL,
    type             VARCHAR(16)  NOT NULL,
    reasons          VARCHAR(255) NOT NULL,
    note             VARCHAR(1000),
    ends_at          TIMESTAMPTZ,
    removed_avatar   BOOLEAN NOT NULL DEFAULT FALSE,
    cleared_bio      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_messages INT     NOT NULL DEFAULT 0,
    created_by_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_by_name  VARCHAR(255) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at  TIMESTAMPTZ,
    revoked_at       TIMESTAMPTZ,
    revoked_by_name  VARCHAR(255),
    CONSTRAINT moderation_actions_type_check CHECK (type IN ('WARNING', 'SUSPENSION', 'BAN')),
    CONSTRAINT moderation_actions_ends_shape CHECK ((type = 'SUSPENSION') = (ends_at IS NOT NULL)),
    CONSTRAINT moderation_actions_ack_shape CHECK (type = 'WARNING' OR acknowledged_at IS NULL)
);
CREATE INDEX idx_moderation_actions_user ON moderation_actions (user_id, created_at DESC);
CREATE INDEX idx_moderation_actions_pending_warnings ON moderation_actions (user_id)
    WHERE type = 'WARNING' AND acknowledged_at IS NULL AND revoked_at IS NULL;

CREATE TABLE reports (
    id                    BIGSERIAL PRIMARY KEY,
    kind                  VARCHAR(16)  NOT NULL,
    reporter_id           BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reporter_username     VARCHAR(255) NOT NULL,
    target_user_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    target_username       VARCHAR(255) NOT NULL,
    target_name           VARCHAR(255),
    target_bio            VARCHAR(1000),
    message_id            BIGINT,
    conversation_id       BIGINT,
    message_body          TEXT,
    message_attachment_filename     VARCHAR(255),
    message_attachment_content_type VARCHAR(100),
    message_created_at    TIMESTAMPTZ,
    reason                VARCHAR(32)  NOT NULL,
    details               VARCHAR(1000),
    status                VARCHAR(16)  NOT NULL DEFAULT 'OPEN',
    action_id             BIGINT REFERENCES moderation_actions(id) ON DELETE SET NULL,
    resolved_at           TIMESTAMPTZ,
    resolved_by_name      VARCHAR(255),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reports_kind_check CHECK (kind IN ('USER', 'MESSAGE')),
    CONSTRAINT reports_reason_check CHECK (reason IN ('SPAM', 'INAPPROPRIATE_AVATAR', 'INAPPROPRIATE_BIO',
        'HARASSMENT', 'THREATS', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT', 'OTHER')),
    CONSTRAINT reports_status_check CHECK (status IN ('OPEN', 'ACTIONED', 'DISMISSED')),
    CONSTRAINT reports_message_shape CHECK ((kind = 'MESSAGE') = (message_id IS NOT NULL)),
    CONSTRAINT reports_other_details CHECK (reason <> 'OTHER' OR length(btrim(coalesce(details, ''))) > 0)
);
CREATE INDEX idx_reports_target_status ON reports (target_user_id, status, created_at DESC);
CREATE INDEX idx_reports_open_created ON reports (created_at DESC) WHERE status = 'OPEN';
CREATE INDEX idx_reports_reporter ON reports (reporter_id, created_at DESC);
CREATE UNIQUE INDEX uq_reports_open_user ON reports (reporter_id, target_user_id, reason)
    WHERE status = 'OPEN' AND kind = 'USER';
CREATE UNIQUE INDEX uq_reports_open_message ON reports (reporter_id, message_id)
    WHERE status = 'OPEN' AND kind = 'MESSAGE';

CREATE TABLE report_evidence (
    report_id    BIGINT PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
    content_type VARCHAR(100) NOT NULL,
    data         BYTEA NOT NULL
);

CREATE TABLE banned_emails (
    id         BIGSERIAL PRIMARY KEY,
    email_hash VARCHAR(64) NOT NULL,
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_banned_emails_hash ON banned_emails (email_hash);
CREATE INDEX idx_banned_emails_user ON banned_emails (user_id);
