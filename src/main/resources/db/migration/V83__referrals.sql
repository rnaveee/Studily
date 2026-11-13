CREATE TABLE referral_codes (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(16) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
    id BIGSERIAL PRIMARY KEY,
    inviter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'REWARDED', 'REJECTED')),
    reason VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rewarded_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_inviter_status ON referrals(inviter_id, status);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'DEADLINE_REMINDER',
        'CLASS_REMINDER',
        'EVENT_TODAY',
        'ITEM_WEEK_AHEAD',
        'EXAM_TODAY',
        'EXAM_COUNTDOWN',
        'ANNOUNCEMENT',
        'FRIEND_REQUEST',
        'FEED_REVIEW',
        'FEED_UPDATE',
        'REFERRAL_REWARD',
        'DONATION_THANKS'));
