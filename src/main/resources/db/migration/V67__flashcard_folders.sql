CREATE TABLE flashcard_folders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_flashcard_folders_user_name ON flashcard_folders(user_id, lower(name));

ALTER TABLE flashcard_sets
    ADD COLUMN folder_id BIGINT REFERENCES flashcard_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_flashcard_sets_folder ON flashcard_sets(folder_id);
CREATE INDEX idx_flashcard_sets_user_course ON flashcard_sets(user_id, course_id);

ALTER TABLE flashcard_runs
    ADD COLUMN folder_id BIGINT REFERENCES flashcard_folders(id) ON DELETE SET NULL,
    ADD COLUMN course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX idx_flashcard_runs_folder ON flashcard_runs(user_id, folder_id, local_date);
CREATE INDEX idx_flashcard_runs_course ON flashcard_runs(user_id, course_id, local_date);

CREATE TABLE flashcard_run_sets (
    run_id BIGINT NOT NULL REFERENCES flashcard_runs(id) ON DELETE CASCADE,
    set_id BIGINT NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    PRIMARY KEY (run_id, set_id)
);
CREATE INDEX idx_flashcard_run_sets_set ON flashcard_run_sets(set_id);
