ALTER TABLE courses ADD COLUMN lms_provider VARCHAR(16);
ALTER TABLE courses ADD COLUMN lms_course_id VARCHAR(100);

CREATE UNIQUE INDEX ux_courses_user_lms_course
    ON courses (user_id, lms_provider, lms_course_id)
    WHERE lms_course_id IS NOT NULL;
