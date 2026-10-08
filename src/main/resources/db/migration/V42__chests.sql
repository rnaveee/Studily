CREATE TABLE chests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(24) NOT NULL,
    source_ref VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_at TIMESTAMPTZ,
    loot_coins INT,
    loot_xp INT,
    loot_badge_code VARCHAR(48) REFERENCES badges(code),
    UNIQUE (user_id, source, source_ref)
);
CREATE INDEX idx_chests_user_unopened ON chests(user_id) WHERE opened_at IS NULL;
