CREATE TABLE course_parse_feedback (
    id BIGSERIAL PRIMARY KEY,
    parse_id BIGINT UNIQUE REFERENCES course_parse_usage(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE course_parse_feedback ADD CONSTRAINT course_parse_feedback_rating_check
    CHECK (rating IN ('ACCURATE', 'MINOR_FIXES', 'INACCURATE'));

CREATE INDEX idx_course_parse_feedback_created_at ON course_parse_feedback (created_at);
