ALTER TABLE course_parse_usage ADD COLUMN feature VARCHAR(20) NOT NULL DEFAULT 'COURSE';
ALTER TABLE course_parse_usage ADD COLUMN succeeded BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_course_parse_usage_feature_user_created
    ON course_parse_usage (feature, user_id, created_at);
CREATE INDEX idx_course_parse_usage_feature_created
    ON course_parse_usage (feature, created_at);
