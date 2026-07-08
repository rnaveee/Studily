ALTER TABLE flashcards ADD COLUMN repetitions      INT              NOT NULL DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN ease_factor      DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE flashcards ADD COLUMN interval_days    INT              NOT NULL DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN due_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW();
ALTER TABLE flashcards ADD COLUMN last_reviewed_at TIMESTAMPTZ;

CREATE INDEX idx_flashcards_due ON flashcards(set_id, due_at);
