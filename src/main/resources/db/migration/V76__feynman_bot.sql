CREATE TABLE feynman_sessions (
                                  id          BIGSERIAL PRIMARY KEY,
                                  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                  title       VARCHAR(120) NOT NULL,
                                  focus       VARCHAR(1000),
                                  plan        TEXT,
                                  status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETE')),
                                  score       INTEGER,
                                  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                                  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feynman_sessions_user ON feynman_sessions(user_id, updated_at DESC);

CREATE TABLE feynman_documents (
                                   id          BIGSERIAL PRIMARY KEY,
                                   session_id  BIGINT NOT NULL REFERENCES feynman_sessions(id) ON DELETE CASCADE,
                                   file_name   VARCHAR(255) NOT NULL,
                                   size_bytes  BIGINT NOT NULL,
                                   content     TEXT NOT NULL,
                                   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feynman_documents_session ON feynman_documents(session_id);

CREATE TABLE feynman_messages (
                                  id          BIGSERIAL PRIMARY KEY,
                                  session_id  BIGINT NOT NULL REFERENCES feynman_sessions(id) ON DELETE CASCADE,
                                  role        VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'BOT')),
                                  kind        VARCHAR(10) NOT NULL DEFAULT 'CHAT' CHECK (kind IN ('CHAT', 'REPORT')),
                                  body        TEXT NOT NULL,
                                  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feynman_messages_session ON feynman_messages(session_id, id);

CREATE TABLE feynman_assessments (
                                     id            BIGSERIAL PRIMARY KEY,
                                     session_id    BIGINT NOT NULL REFERENCES feynman_sessions(id) ON DELETE CASCADE,
                                     message_id    BIGINT NOT NULL REFERENCES feynman_messages(id) ON DELETE CASCADE,
                                     concept       VARCHAR(200) NOT NULL,
                                     score         INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
                                     gaps          TEXT,
                                     did_not_know  BOOLEAN NOT NULL DEFAULT FALSE,
                                     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feynman_assessments_session ON feynman_assessments(session_id, id);