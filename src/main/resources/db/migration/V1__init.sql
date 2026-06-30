CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    username      VARCHAR(255)  NOT NULL UNIQUE,
    name          VARCHAR(255),
    school        VARCHAR(255),
    school_id     VARCHAR(255),
    year          INTEGER,
    major         VARCHAR(255),
    bio           VARCHAR(1000),
    avatar_url    VARCHAR(255),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE semesters (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id),
    term       VARCHAR(50)  NOT NULL,
    year       INTEGER      NOT NULL,
    start_date DATE         NOT NULL,
    end_date   DATE         NOT NULL
);

CREATE TABLE courses (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id),
    semester_id BIGINT               REFERENCES semesters(id),
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(255),
    professor   VARCHAR(255),
    color       VARCHAR(50)
);

CREATE TABLE meeting_blocks (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT      NOT NULL REFERENCES courses(id),
    day_of_week VARCHAR(20) NOT NULL,
    start_time  TIME        NOT NULL,
    end_time    TIME        NOT NULL
);

CREATE TABLE academic_items (
    id        BIGSERIAL PRIMARY KEY,
    course_id BIGINT       NOT NULL REFERENCES courses(id),
    type      VARCHAR(20)  NOT NULL,
    title     VARCHAR(255) NOT NULL,
    due_at    TIMESTAMPTZ  NOT NULL,
    location  VARCHAR(255),
    weight    DOUBLE PRECISION,
    status    VARCHAR(20)  NOT NULL DEFAULT 'TODO'
);

CREATE TABLE notes (
    id         BIGSERIAL PRIMARY KEY,
    course_id  BIGINT        NOT NULL REFERENCES courses(id),
    body       VARCHAR(10000) NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id),
    type            VARCHAR(50) NOT NULL,
    message         VARCHAR(255) NOT NULL,
    related_item_id BIGINT,
    read            BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
