export const CREATE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS transport_lines (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('colectivo', 'tren', 'subte', 'trolebus')),
  operator TEXT,
  color TEXT NOT NULL,
  text_color TEXT NOT NULL,
  origin TEXT,
  destination TEXT,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anonymous_identities (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_logs (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES transport_lines(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  anonymous_identity_id TEXT REFERENCES anonymous_identities(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 5),
  review_text TEXT,
  liked INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0, 1)),
  tags_json TEXT NOT NULL DEFAULT '[]',
  traveled_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (
    (user_id IS NOT NULL AND anonymous_identity_id IS NULL) OR
    (user_id IS NULL AND anonymous_identity_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_trip_logs_created_at ON trip_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_logs_line_id ON trip_logs(line_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_user_id ON trip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lines_province ON transport_lines(province);
CREATE INDEX IF NOT EXISTS idx_follows_followed_id ON follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
`;

export const MIGRATE_TRIP_LOGS_TO_ANONYMOUS_AUTHORS = `
BEGIN IMMEDIATE;

DROP TABLE IF EXISTS trip_logs_v2;

CREATE TABLE trip_logs_v2 (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES transport_lines(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  anonymous_identity_id TEXT REFERENCES anonymous_identities(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 5),
  review_text TEXT,
  liked INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0, 1)),
  tags_json TEXT NOT NULL DEFAULT '[]',
  traveled_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (
    (user_id IS NOT NULL AND anonymous_identity_id IS NULL) OR
    (user_id IS NULL AND anonymous_identity_id IS NOT NULL)
  )
);

INSERT INTO trip_logs_v2 (
  id, line_id, user_id, anonymous_identity_id, rating, review_text, liked, tags_json, traveled_at, created_at
)
SELECT id, line_id, user_id, NULL, rating, review_text, 0, '[]', traveled_at, created_at
FROM trip_logs;

DROP TABLE trip_logs;
ALTER TABLE trip_logs_v2 RENAME TO trip_logs;

CREATE INDEX idx_trip_logs_created_at ON trip_logs(created_at DESC);
CREATE INDEX idx_trip_logs_line_id ON trip_logs(line_id);
CREATE INDEX idx_trip_logs_user_id ON trip_logs(user_id);
CREATE INDEX idx_trip_logs_anonymous_identity_id ON trip_logs(anonymous_identity_id);

COMMIT;
`;

export const MIGRATE_TRIP_LOGS_TO_REVIEW_METADATA = `
BEGIN IMMEDIATE;

DROP TABLE IF EXISTS trip_logs_v3;

CREATE TABLE trip_logs_v3 (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES transport_lines(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  anonymous_identity_id TEXT REFERENCES anonymous_identities(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 5),
  review_text TEXT,
  liked INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0, 1)),
  tags_json TEXT NOT NULL DEFAULT '[]',
  traveled_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (
    (user_id IS NOT NULL AND anonymous_identity_id IS NULL) OR
    (user_id IS NULL AND anonymous_identity_id IS NOT NULL)
  )
);

INSERT INTO trip_logs_v3 (
  id, line_id, user_id, anonymous_identity_id, rating, review_text, liked, tags_json, traveled_at, created_at
)
SELECT id, line_id, user_id, anonymous_identity_id, rating, review_text, 0, '[]', traveled_at, created_at
FROM trip_logs;

DROP TABLE trip_logs;
ALTER TABLE trip_logs_v3 RENAME TO trip_logs;

CREATE INDEX idx_trip_logs_created_at ON trip_logs(created_at DESC);
CREATE INDEX idx_trip_logs_line_id ON trip_logs(line_id);
CREATE INDEX idx_trip_logs_user_id ON trip_logs(user_id);
CREATE INDEX idx_trip_logs_anonymous_identity_id ON trip_logs(anonymous_identity_id);

COMMIT;
`;

export const MIGRATE_USERS_TO_OPTIONAL_EMAIL = `
BEGIN IMMEDIATE;

DROP TABLE IF EXISTS users_v2;

CREATE TABLE users_v2 (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO users_v2 (id, username, email, password_hash, created_at)
SELECT id, username, email, password_hash, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_v2 RENAME TO users;

COMMIT;
`;
