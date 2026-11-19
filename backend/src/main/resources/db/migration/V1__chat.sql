CREATE TABLE messages (
    id UUID PRIMARY KEY,
    author VARCHAR(40) NOT NULL,
    body VARCHAR(2000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    instance VARCHAR(255) NOT NULL
);
CREATE INDEX messages_created_at_idx ON messages (created_at DESC, id DESC);
CREATE TABLE outbox (
    id UUID PRIMARY KEY REFERENCES messages(id),
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
