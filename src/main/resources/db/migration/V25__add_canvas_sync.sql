ALTER TABLE courses ADD COLUMN canvas_course_id BIGINT;
ALTER TABLE courses ADD COLUMN canvas_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX ux_courses_user_canvas_course_id
    ON courses (user_id, canvas_course_id)
    WHERE canvas_course_id IS NOT NULL;

ALTER TABLE academic_items ADD COLUMN external_uid VARCHAR(255);

CREATE UNIQUE INDEX ux_academic_items_course_external_uid
    ON academic_items (course_id, external_uid)
    WHERE external_uid IS NOT NULL;
