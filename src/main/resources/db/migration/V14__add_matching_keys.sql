ALTER TABLE users ADD COLUMN school_key VARCHAR(255);
ALTER TABLE courses ADD COLUMN code_key VARCHAR(64);

CREATE INDEX idx_users_school_key ON users (school_key);
CREATE INDEX idx_courses_code_key ON courses (code_key);
