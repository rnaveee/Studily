ALTER TABLE users ADD COLUMN avatar_key VARCHAR(64);

UPDATE users
SET avatar_key = replace(gen_random_uuid()::text, '-', '')
WHERE avatar_image IS NOT NULL;
