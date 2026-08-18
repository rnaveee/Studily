CREATE TABLE todo_categories (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(60) NOT NULL,
    color      VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_todo_categories_user ON todo_categories (user_id);
CREATE UNIQUE INDEX ux_todo_categories_user_name ON todo_categories (user_id, lower(name));

CREATE TABLE todos (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  BIGINT       REFERENCES todo_categories(id) ON DELETE SET NULL,
    title        VARCHAR(255) NOT NULL,
    notes        TEXT,
    priority     VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    due_at       TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_todos_user_due ON todos (user_id, due_at);
CREATE INDEX idx_todos_category ON todos (category_id);

CREATE TABLE todo_checklist_items (
    id       BIGSERIAL PRIMARY KEY,
    todo_id  BIGINT       NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    text     VARCHAR(255) NOT NULL,
    done     BOOLEAN      NOT NULL DEFAULT FALSE,
    position INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_todo_checklist_items_todo ON todo_checklist_items (todo_id, position);
