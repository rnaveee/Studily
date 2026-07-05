CREATE TABLE conversations (
    id              BIGSERIAL PRIMARY KEY,
    type            VARCHAR(20) NOT NULL,
    name            VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

CREATE TABLE conversation_members (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT      NOT NULL REFERENCES conversations(id),
    user_id         BIGINT      NOT NULL REFERENCES users(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversation_members_unique_member UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);

CREATE TABLE messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT      NOT NULL REFERENCES conversations(id),
    sender_id       BIGINT      NOT NULL REFERENCES users(id),
    body            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
