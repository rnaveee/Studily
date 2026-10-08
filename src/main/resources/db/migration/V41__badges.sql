CREATE TABLE badges (
    code VARCHAR(48) PRIMARY KEY,
    category VARCHAR(16) NOT NULL,
    title VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    image_key VARCHAR(128) NOT NULL,
    price_coins INT CHECK (price_coins IS NULL OR price_coins > 0),
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_badges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_code VARCHAR(48) NOT NULL REFERENCES badges(code),
    source VARCHAR(16) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    featured_slot SMALLINT CHECK (featured_slot BETWEEN 1 AND 3),
    UNIQUE (user_id, badge_code)
);
CREATE UNIQUE INDEX uq_user_badges_featured ON user_badges(user_id, featured_slot) WHERE featured_slot IS NOT NULL;

INSERT INTO badges (code, category, title, description, image_key, price_coins, sort_order) VALUES
    ('level_1', 'LEVEL', 'Level 1', 'Start your Studily journey.', 'level_1.webp', NULL, 10),
    ('level_5', 'LEVEL', 'Level 5', 'Reach level 5.', 'level_5.webp', NULL, 20),
    ('level_10', 'LEVEL', 'Level 10', 'Reach level 10.', 'level_10.webp', NULL, 30),
    ('level_20', 'LEVEL', 'Level 20', 'Reach level 20.', 'level_20.webp', NULL, 40),
    ('level_30', 'LEVEL', 'Level 30', 'Reach level 30.', 'level_30.webp', NULL, 50),
    ('level_50', 'LEVEL', 'Level 50', 'Reach level 50.', 'level_50.webp', NULL, 60),
    ('level_75', 'LEVEL', 'Level 75', 'Reach level 75.', 'level_75.webp', NULL, 70),
    ('level_100', 'LEVEL', 'Level 100', 'Reach level 100.', 'level_100.webp', NULL, 80),
    ('friends_5', 'SOCIAL', 'Making Friends', 'Have 5+ friends on Studily.', 'friends_5.webp', NULL, 10),
    ('friends_10', 'SOCIAL', 'Study Circle', 'Have 10+ friends on Studily.', 'friends_10.webp', NULL, 20),
    ('friends_20', 'SOCIAL', 'Popular!', 'Have 20+ friends on Studily.', 'friends_20.webp', NULL, 30),
    ('friends_50', 'SOCIAL', 'Campus Famous', 'Have 50+ friends on Studily.', 'friends_50.webp', NULL, 40),
    ('schoolmates_10', 'SOCIAL', 'School Spirit', 'Have 10+ friends from your school.', 'schoolmates_10.webp', NULL, 50),
    ('og', 'TENURE', 'OG', 'Joined Studily in its first two months.', 'og.webp', NULL, 10),
    ('member_1m', 'TENURE', 'One Month In', 'Be a Studily member for 1 month.', 'member_1m.webp', NULL, 20),
    ('member_6m', 'TENURE', 'Half-Year Scholar', 'Be a Studily member for 6 months.', 'member_6m.webp', NULL, 30),
    ('member_1y', 'TENURE', 'One Year Strong', 'Be a Studily member for 1 year.', 'member_1y.webp', NULL, 40),
    ('first_session', 'STUDY', 'First Focus', 'Complete your first study session.', 'first_session.webp', NULL, 10),
    ('streak_7', 'STUDY', 'On Fire', 'Reach a 7-day study streak.', 'streak_7.webp', NULL, 20),
    ('streak_30', 'STUDY', 'Unstoppable', 'Reach a 30-day study streak.', 'streak_30.webp', NULL, 30),
    ('hours_10', 'STUDY', 'Ten Hours Deep', 'Study for 10 hours in sessions.', 'hours_10.webp', NULL, 40),
    ('hours_100', 'STUDY', 'Centurion', 'Study for 100 hours in sessions.', 'hours_100.webp', NULL, 50),
    ('runs_10', 'FLASHCARDS', 'Card Shark', 'Complete 10 flashcard runs.', 'runs_10.webp', NULL, 10),
    ('runs_100', 'FLASHCARDS', 'Flashcard Master', 'Complete 100 flashcard runs.', 'runs_100.webp', NULL, 20),
    ('cosmetic_spark', 'COSMETIC', 'Spark', 'A little flair for your profile.', 'cosmetic_spark.webp', 300, 10),
    ('cosmetic_comet', 'COSMETIC', 'Comet', 'Streak across the leaderboard in style.', 'cosmetic_comet.webp', 600, 20),
    ('cosmetic_crown', 'COSMETIC', 'Crown', 'For the true royalty of studying.', 'cosmetic_crown.webp', 1200, 30);
