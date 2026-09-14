CREATE TABLE grade_categories (
    id         BIGSERIAL PRIMARY KEY,
    course_id  BIGINT           NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name       VARCHAR(60)      NOT NULL,
    kind       VARCHAR(20)      NOT NULL,
    weight     DOUBLE PRECISION NOT NULL,
    color      VARCHAR(32)      NOT NULL,
    position   INT              NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grade_categories_course ON grade_categories (course_id);
CREATE UNIQUE INDEX ux_grade_categories_course_name ON grade_categories (course_id, lower(name));

ALTER TABLE academic_items
    ADD COLUMN grade_category_id BIGINT REFERENCES grade_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_academic_items_grade_category ON academic_items (grade_category_id);
