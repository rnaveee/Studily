ALTER TABLE users ADD COLUMN welcomed_at TIMESTAMPTZ;
UPDATE users SET welcomed_at = now();

INSERT INTO chests (user_id, source, source_ref, tier)
SELECT id, 'WELCOME', 'welcome', 'DIAMOND' FROM users
ON CONFLICT (user_id, source, source_ref) DO NOTHING;
