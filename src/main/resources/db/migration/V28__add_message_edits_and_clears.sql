ALTER TABLE messages ADD COLUMN edited_at TIMESTAMPTZ;

ALTER TABLE conversation_members
    ADD COLUMN cleared_up_to_message_id BIGINT NOT NULL DEFAULT 0;
