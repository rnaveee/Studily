CREATE TABLE flairs (
    code VARCHAR(48) PRIMARY KEY,
    title VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    rarity VARCHAR(16) NOT NULL,
    unlock VARCHAR(16) NOT NULL,
    price_coins INT CHECK (price_coins IS NULL OR price_coins > 0),
    streak_days INT CHECK (streak_days IS NULL OR streak_days > 0),
    image_key VARCHAR(128),
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_flairs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flair_code VARCHAR(48) NOT NULL REFERENCES flairs(code),
    source VARCHAR(16) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, flair_code)
);
CREATE INDEX idx_user_flairs_user ON user_flairs(user_id);

ALTER TABLE users ADD COLUMN equipped_flair_code VARCHAR(48) REFERENCES flairs(code) ON DELETE SET NULL;
ALTER TABLE chests ADD COLUMN loot_flair_code VARCHAR(48) REFERENCES flairs(code);

INSERT INTO flairs (code, title, description, rarity, unlock, price_coins, streak_days, sort_order) VALUES
    ('ring_mint', 'Mint', 'A cool, fresh ring.', 'COMMON', 'SHOP', 250, NULL, 10),
    ('ring_ocean', 'Ocean', 'Deep blue, calm focus.', 'COMMON', 'SHOP', 250, NULL, 20),
    ('ring_sunset', 'Sunset', 'Warm evening gradient.', 'RARE', 'SHOP', 500, NULL, 30),
    ('ring_gold', 'Gold', 'Polished and proud.', 'RARE', 'SHOP', 750, NULL, 40),
    ('ring_neon', 'Neon Pulse', 'A ring that hums with light.', 'EPIC', 'SHOP', 1200, NULL, 50),
    ('ring_aurora', 'Aurora', 'Shifting northern lights.', 'EPIC', 'SHOP', 1500, NULL, 60),
    ('ring_prism', 'Prism', 'Found only in chests.', 'EPIC', 'CHEST', NULL, NULL, 70),
    ('ring_galaxy', 'Galaxy', 'A rare find from a chest.', 'LEGENDARY', 'CHEST', NULL, NULL, 80),
    ('ring_ember', 'Ember', 'Reach a 7-day study streak.', 'RARE', 'STREAK', NULL, 7, 90),
    ('ring_blaze', 'Blaze', 'Reach a 30-day study streak.', 'EPIC', 'STREAK', NULL, 30, 100),
    ('ring_inferno', 'Inferno', 'Reach a 100-day study streak.', 'LEGENDARY', 'STREAK', NULL, 100, 110);
