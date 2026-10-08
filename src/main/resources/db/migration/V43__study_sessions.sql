CREATE TABLE study_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(16) NOT NULL,
    planned_blocks INT NOT NULL CHECK (planned_blocks BETWEEN 1 AND 8),
    block_minutes INT NOT NULL,
    break_minutes INT NOT NULL,
    planned_minutes INT NOT NULL CHECK (planned_minutes BETWEEN 25 AND 200),
    status VARCHAR(16) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    local_date DATE NOT NULL,
    credited_minutes INT NOT NULL DEFAULT 0,
    xp_awarded INT NOT NULL DEFAULT 0,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    current_block INT NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX uq_study_sessions_one_open ON study_sessions(user_id) WHERE status IN ('ACTIVE', 'PAUSED');
CREATE INDEX idx_study_sessions_user_started ON study_sessions(user_id, started_at DESC);
CREATE INDEX idx_study_sessions_user_date ON study_sessions(user_id, local_date);

CREATE TABLE study_session_blocks (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    block_index INT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    notified_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL,
    credited_minutes INT NOT NULL DEFAULT 0,
    xp_awarded INT NOT NULL DEFAULT 0,
    UNIQUE (session_id, block_index)
);
CREATE INDEX idx_study_session_blocks_running_due ON study_session_blocks(due_at) WHERE status = 'RUNNING';

CREATE TABLE study_session_tasks (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    position INT NOT NULL,
    text VARCHAR(200) NOT NULL,
    done_at TIMESTAMPTZ,
    xp_awarded INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_study_session_tasks_session ON study_session_tasks(session_id);
