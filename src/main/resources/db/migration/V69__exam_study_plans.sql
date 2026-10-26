CREATE TABLE exam_study_links (
    id               BIGSERIAL PRIMARY KEY,
    exam_item_id     BIGINT NOT NULL REFERENCES academic_items(id) ON DELETE CASCADE,
    flashcard_set_id BIGINT REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    todo_id          BIGINT REFERENCES todos(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((flashcard_set_id IS NULL) <> (todo_id IS NULL))
);

CREATE UNIQUE INDEX ux_exam_study_links_set
    ON exam_study_links(exam_item_id, flashcard_set_id) WHERE flashcard_set_id IS NOT NULL;
CREATE UNIQUE INDEX ux_exam_study_links_todo
    ON exam_study_links(exam_item_id, todo_id) WHERE todo_id IS NOT NULL;
CREATE INDEX idx_exam_study_links_set ON exam_study_links(flashcard_set_id);
CREATE INDEX idx_exam_study_links_todo ON exam_study_links(todo_id);

ALTER TABLE notification_prefs ADD COLUMN exam_countdown BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'DEADLINE_REMINDER',
        'CLASS_REMINDER',
        'EVENT_TODAY',
        'ITEM_WEEK_AHEAD',
        'EXAM_TODAY',
        'EXAM_COUNTDOWN',
        'ANNOUNCEMENT'));
