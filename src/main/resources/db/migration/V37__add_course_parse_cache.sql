CREATE TABLE course_parse_cache (
    cache_key VARCHAR(64) PRIMARY KEY,
    draft TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    hit_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_parse_cache_created_at ON course_parse_cache (created_at);

CREATE INDEX idx_course_parse_usage_user_created ON course_parse_usage (user_id, created_at);
