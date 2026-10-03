ALTER TABLE flashcard_sets ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'PRIVATE';

CREATE INDEX idx_flashcard_sets_public ON flashcard_sets(user_id) WHERE visibility = 'PUBLIC';
