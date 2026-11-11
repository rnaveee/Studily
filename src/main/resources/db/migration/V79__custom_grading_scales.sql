CREATE TABLE custom_grading_scales (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(40),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE custom_grading_scale_bands (
    user_id BIGINT NOT NULL REFERENCES custom_grading_scales(user_id) ON DELETE CASCADE,
    min_percent SMALLINT NOT NULL CHECK (min_percent >= 0 AND min_percent <= 100),
    letter VARCHAR(4) NOT NULL,
    points NUMERIC(5,2) NOT NULL CHECK (points >= 0 AND points <= 20),
    PRIMARY KEY (user_id, min_percent)
);
ALTER TABLE users DROP CONSTRAINT users_gpa_scale_check;
ALTER TABLE users ADD CONSTRAINT users_gpa_scale_check CHECK (gpa_scale IS NULL OR gpa_scale IN ('FOUR_POINT', 'FOUR_THREE_THREE', 'NINE_POINT', 'UBC_PERCENT', 'CUSTOM'));
