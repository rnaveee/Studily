CREATE TABLE bot_outfits (
    code VARCHAR(48) PRIMARY KEY,
    title VARCHAR(64) NOT NULL,
    slot VARCHAR(16) NOT NULL CHECK (slot IN ('TOP', 'BOTTOM')),
    rarity VARCHAR(16) NOT NULL,
    unlock VARCHAR(16) NOT NULL CHECK (unlock IN ('STARTER', 'SHOP', 'CHEST')),
    price_coins INT CHECK (price_coins IS NULL OR price_coins > 0),
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_bot_outfits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outfit_code VARCHAR(48) NOT NULL REFERENCES bot_outfits(code),
    source VARCHAR(16) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, outfit_code)
);
CREATE INDEX idx_user_bot_outfits_user ON user_bot_outfits(user_id);

INSERT INTO bot_outfits (code, title, slot, rarity, unlock, price_coins, sort_order) VALUES
    ('hoodie_classic', 'Classic Indigo Hoodie', 'TOP', 'COMMON', 'STARTER', NULL, 10),
    ('hoodie_varsity', 'Varsity Hoodie', 'TOP', 'RARE', 'SHOP', 500, 20),
    ('hoodie_sunset', 'Sunset Hoodie', 'TOP', 'EPIC', 'SHOP', 1200, 30),
    ('hoodie_aurora', 'Aurora Zip Hoodie', 'TOP', 'LEGENDARY', 'CHEST', NULL, 40),
    ('pants_joggers', 'Grey Joggers', 'BOTTOM', 'COMMON', 'STARTER', NULL, 50),
    ('pants_jeans', 'Blue Jeans', 'BOTTOM', 'COMMON', 'SHOP', 250, 60),
    ('pants_pajama', 'Plaid Pajama Pants', 'BOTTOM', 'RARE', 'SHOP', 500, 70),
    ('shorts_cargo', 'Cargo Shorts', 'BOTTOM', 'RARE', 'SHOP', 500, 80);

ALTER TABLE users
    ADD COLUMN bot_top_code VARCHAR(48) DEFAULT 'hoodie_classic' REFERENCES bot_outfits(code) ON DELETE SET NULL,
    ADD COLUMN bot_bottom_code VARCHAR(48) DEFAULT 'pants_joggers' REFERENCES bot_outfits(code) ON DELETE SET NULL;

ALTER TABLE chests ADD COLUMN loot_outfit_code VARCHAR(48) REFERENCES bot_outfits(code);
