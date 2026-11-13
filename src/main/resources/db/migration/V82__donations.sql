CREATE TABLE donations (
    id UUID PRIMARY KEY,
    user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
    amount_cents INT NOT NULL CHECK (amount_cents BETWEEN 200 AND 100000),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'cad'),
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'PAID', 'REFUNDED', 'DISPUTED', 'EXPIRED')),
    stripe_session_id VARCHAR UNIQUE,
    stripe_payment_intent VARCHAR UNIQUE,
    checkout_url TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ
);

CREATE INDEX idx_donations_user_status_created ON donations (user_id, status, created_at);

CREATE TABLE stripe_events (
    event_id VARCHAR PRIMARY KEY,
    type VARCHAR NOT NULL,
    received_at TIMESTAMPTZ NOT NULL
);
