CREATE TABLE course_parse_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    input_tokens BIGINT NOT NULL,
    output_tokens BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_parse_usage_created_at ON course_parse_usage (created_at);
CREATE INDEX idx_course_parse_usage_user_id ON course_parse_usage (user_id);
