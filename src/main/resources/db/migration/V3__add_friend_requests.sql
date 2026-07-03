CREATE TABLE friend_requests (
    id           BIGSERIAL PRIMARY KEY,
    requester_id BIGINT      NOT NULL REFERENCES users(id),
    addressee_id BIGINT      NOT NULL REFERENCES users(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT friend_requests_no_self CHECK (requester_id <> addressee_id),
    CONSTRAINT friend_requests_unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_friend_requests_addressee ON friend_requests(addressee_id, status);
CREATE INDEX idx_friend_requests_requester ON friend_requests(requester_id, status);
