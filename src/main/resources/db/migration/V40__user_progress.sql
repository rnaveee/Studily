CREATE TABLE user_progress (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    coins INT NOT NULL DEFAULT 0 CHECK (coins >= 0),
    streak_current INT NOT NULL DEFAULT 0,
    streak_best INT NOT NULL DEFAULT 0,
    streak_last_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO user_progress (user_id) SELECT id FROM users;

CREATE TABLE xp_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL,
    amount INT NOT NULL CHECK (amount >= 0),
    dedupe_key VARCHAR(128) UNIQUE,
    ref_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_events_user_source_created ON xp_events(user_id, source, created_at);

CREATE TABLE coin_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason VARCHAR(32) NOT NULL,
    ref VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coin_transactions_user_created ON coin_transactions(user_id, created_at);
