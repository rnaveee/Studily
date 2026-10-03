ALTER TABLE flashcard_sets ADD COLUMN copied_from_set_id BIGINT REFERENCES flashcard_sets(id) ON DELETE SET NULL;
ALTER TABLE flashcard_sets ADD COLUMN copied_from_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_flashcard_sets_copied_from_set ON flashcard_sets(copied_from_set_id);
CREATE INDEX idx_flashcard_sets_copied_from_user ON flashcard_sets(copied_from_user_id);
