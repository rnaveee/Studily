CREATE TABLE flashcard_images (
    id BIGSERIAL PRIMARY KEY,
    image_key VARCHAR(32) NOT NULL UNIQUE,
    owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(32) NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    size_bytes INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flashcard_images_owner ON flashcard_images(owner_id);
CREATE INDEX idx_flashcard_images_created ON flashcard_images(created_at);

CREATE TABLE flashcard_image_data (
    image_id BIGINT PRIMARY KEY REFERENCES flashcard_images(id) ON DELETE CASCADE,
    data BYTEA NOT NULL
);

ALTER TABLE flashcards
    ADD COLUMN front_image_key VARCHAR(32) REFERENCES flashcard_images(image_key) ON DELETE SET NULL,
    ADD COLUMN back_image_key VARCHAR(32) REFERENCES flashcard_images(image_key) ON DELETE SET NULL;
CREATE INDEX idx_flashcards_front_image ON flashcards(front_image_key) WHERE front_image_key IS NOT NULL;
CREATE INDEX idx_flashcards_back_image ON flashcards(back_image_key) WHERE back_image_key IS NOT NULL;
