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
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_logs (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES transport_lines(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  traveled_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_logs_created_at ON trip_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_logs_line_id ON trip_logs(line_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_user_id ON trip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lines_province ON transport_lines(province);
`;
