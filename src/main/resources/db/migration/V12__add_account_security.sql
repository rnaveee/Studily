ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE account_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    type       VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_tokens_user ON account_tokens(user_id);

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT tc.table_name::text AS table_name, tc.constraint_name::text AS constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = current_schema()
          AND (tc.table_name::text, kcu.column_name::text) IN (
              ('semesters', 'user_id'),
              ('courses', 'user_id'),
              ('meeting_blocks', 'course_id'),
              ('academic_items', 'course_id'),
              ('notes', 'course_id'),
              ('notifications', 'user_id'),
              ('friend_requests', 'requester_id'),
              ('friend_requests', 'addressee_id'),
              ('conversation_members', 'conversation_id'),
              ('conversation_members', 'user_id'),
              ('messages', 'conversation_id'),
              ('messages', 'sender_id'),
              ('flashcard_sets', 'user_id'),
              ('calendar_events', 'user_id'))
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE semesters ADD CONSTRAINT semesters_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE courses ADD CONSTRAINT courses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE meeting_blocks ADD CONSTRAINT meeting_blocks_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE academic_items ADD CONSTRAINT academic_items_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE notes ADD CONSTRAINT notes_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_requester_id_fkey
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_addressee_id_fkey
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE conversation_members ADD CONSTRAINT conversation_members_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE conversation_members ADD CONSTRAINT conversation_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE flashcard_sets ADD CONSTRAINT flashcard_sets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
