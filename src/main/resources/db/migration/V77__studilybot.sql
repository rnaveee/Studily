CREATE TABLE bot_chats (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode           VARCHAR(10)  NOT NULL CHECK (mode IN ('CHAT', 'PRACTICE')),
    course_id      BIGINT       REFERENCES courses(id) ON DELETE SET NULL,
    title          VARCHAR(120) NOT NULL,
    difficulty     VARCHAR(10)  CHECK (difficulty IS NULL OR difficulty IN ('EASY', 'MEDIUM', 'HARD', 'CLASS')),
    topic          VARCHAR(300),
    parent_chat_id BIGINT       REFERENCES bot_chats(id) ON DELETE CASCADE,
    temporary      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_chats_user_mode ON bot_chats (user_id, mode, updated_at DESC);
CREATE INDEX idx_bot_chats_parent ON bot_chats (parent_chat_id) WHERE parent_chat_id IS NOT NULL;

CREATE TABLE bot_messages (
    id         BIGSERIAL PRIMARY KEY,
    chat_id    BIGINT      NOT NULL REFERENCES bot_chats(id) ON DELETE CASCADE,
    role       VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'BOT')),
    kind       VARCHAR(10) NOT NULL DEFAULT 'TEXT' CHECK (kind IN ('TEXT', 'PROBLEM', 'GRADE')),
    content    TEXT        NOT NULL,
    meta       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_messages_chat ON bot_messages (chat_id, id);

CREATE TABLE bank_files (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id       BIGINT       REFERENCES courses(id) ON DELETE CASCADE,
    chat_id         BIGINT       REFERENCES bot_chats(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    content_type    VARCHAR(150) NOT NULL,
    format          VARCHAR(10)  NOT NULL CHECK (format IN ('PDF', 'DOCX', 'PPTX', 'TEXT', 'MARKDOWN')),
    kind            VARCHAR(20)  NOT NULL DEFAULT 'OTHER'
        CHECK (kind IN ('LECTURE', 'ASSIGNMENT', 'PRACTICE_EXAM', 'NOTES', 'OTHER')),
    size_bytes      BIGINT       NOT NULL,
    sha256          VARCHAR(64)  NOT NULL,
    storage_key     VARCHAR(255) NOT NULL UNIQUE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
    status_detail   VARCHAR(255),
    page_count      INT,
    chunk_count     INT          NOT NULL DEFAULT 0,
    embedding_model VARCHAR(60),
    attempts        INT          NOT NULL DEFAULT 0,
    locked_at       TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    indexed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(course_id, chat_id) = 1)
);

CREATE INDEX idx_bank_files_course ON bank_files (course_id) WHERE course_id IS NOT NULL;
CREATE INDEX idx_bank_files_chat ON bank_files (chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX idx_bank_files_user ON bank_files (user_id);
CREATE INDEX idx_bank_files_queue ON bank_files (id) WHERE status IN ('QUEUED', 'PROCESSING');
CREATE UNIQUE INDEX uq_bank_files_course_hash ON bank_files (course_id, sha256) WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX uq_bank_files_chat_hash ON bank_files (chat_id, sha256) WHERE chat_id IS NOT NULL;

CREATE TABLE bank_chunks (
    id             BIGSERIAL PRIMARY KEY,
    file_id        BIGINT       NOT NULL REFERENCES bank_files(id) ON DELETE CASCADE,
    user_id        BIGINT       NOT NULL,
    course_id      BIGINT,
    chat_id        BIGINT,
    chunk_index    INT          NOT NULL,
    page_from      INT,
    page_to        INT,
    heading        VARCHAR(300),
    content        TEXT         NOT NULL,
    token_estimate INT          NOT NULL,
    embedding      REAL[]       NOT NULL,
    content_tsv    tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(heading, '') || ' ' || content)) STORED
);

CREATE INDEX idx_bank_chunks_course ON bank_chunks (user_id, course_id) WHERE course_id IS NOT NULL;
CREATE INDEX idx_bank_chunks_chat ON bank_chunks (user_id, chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX idx_bank_chunks_file ON bank_chunks (file_id);
CREATE INDEX idx_bank_chunks_tsv ON bank_chunks USING gin (content_tsv);

CREATE TABLE storage_trash (
    storage_key VARCHAR(255) PRIMARY KEY,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE FUNCTION queue_storage_delete() RETURNS trigger AS $$
BEGIN
    INSERT INTO storage_trash (storage_key) VALUES (OLD.storage_key) ON CONFLICT DO NOTHING;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bank_files_storage_trash
    AFTER DELETE ON bank_files
    FOR EACH ROW EXECUTE FUNCTION queue_storage_delete();

ALTER TABLE feynman_sessions ADD COLUMN course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE feynman_documents ADD COLUMN bank_file_id BIGINT REFERENCES bank_files(id) ON DELETE SET NULL;
