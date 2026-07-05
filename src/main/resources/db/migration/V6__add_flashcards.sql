CREATE TABLE flashcard_sets (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id),
    course_id  BIGINT      REFERENCES courses(id),
    title      VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flashcard_sets_user ON flashcard_sets(user_id);
CREATE INDEX idx_flashcard_sets_course ON flashcard_sets(course_id);

CREATE TABLE flashcards (
    id       BIGSERIAL PRIMARY KEY,
    set_id   BIGINT NOT NULL REFERENCES flashcard_sets(id),
    front    TEXT   NOT NULL,
    back     TEXT   NOT NULL,
    position INT    NOT NULL DEFAULT 0
);

CREATE INDEX idx_flashcards_set ON flashcards(set_id, position);
