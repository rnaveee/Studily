ALTER TABLE messages
    ADD COLUMN attachment_filename     VARCHAR(255),
    ADD COLUMN attachment_content_type VARCHAR(100),
    ADD COLUMN attachment_size         BIGINT,
    ADD COLUMN attachment_width        INT,
    ADD COLUMN attachment_height       INT;

CREATE TABLE message_attachments (
    message_id BIGINT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    data       BYTEA  NOT NULL
);
