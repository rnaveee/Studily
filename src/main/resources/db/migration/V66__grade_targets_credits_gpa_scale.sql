ALTER TABLE courses
    ADD COLUMN credits NUMERIC(4,2) NULL,
    ADD COLUMN target_grade DOUBLE PRECISION NULL,
    ADD CONSTRAINT courses_credits_range CHECK (credits IS NULL OR (credits >= 0 AND credits <= 30)),
    ADD CONSTRAINT courses_target_grade_range CHECK (target_grade IS NULL OR (target_grade >= 0 AND target_grade <= 150));

ALTER TABLE users
    ADD COLUMN gpa_scale VARCHAR(16) NULL,
    ADD CONSTRAINT users_gpa_scale_check CHECK (gpa_scale IS NULL OR gpa_scale IN ('FOUR_POINT', 'FOUR_THREE_THREE', 'NINE_POINT', 'UBC_PERCENT'));
