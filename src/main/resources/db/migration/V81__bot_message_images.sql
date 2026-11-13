CREATE TABLE bot_message_images (
    id          UUID PRIMARY KEY,
    message_id  BIGINT      NOT NULL REFERENCES bot_messages(id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    mime_type   VARCHAR(16) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes  INT         NOT NULL,
    position    SMALLINT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_message_images_message ON bot_message_images(message_id);

CREATE TRIGGER trg_bot_message_images_storage_trash
    AFTER DELETE ON bot_message_images
    FOR EACH ROW EXECUTE FUNCTION queue_storage_delete();
