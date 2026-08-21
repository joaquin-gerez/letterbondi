// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase, migrateAnonymousAuthors, migrateTripReviewMetadata, migrateUsersToOptionalEmail, type Database } from '../db/index.js';

describe('migración de autores anónimos', () => {
  let db: Database | null = null;

  afterEach(() => { db?.close(); db = null; });

  it('conserva reseñas registradas y habilita exactamente un tipo de autor', async () => {
    db = createTestDatabase();
    await db.executeMultiple(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE transport_lines (id TEXT PRIMARY KEY);
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE anonymous_identities (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
      );
      CREATE TABLE trip_logs (
        id TEXT PRIMARY KEY,
        line_id TEXT NOT NULL REFERENCES transport_lines(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        rating INTEGER NOT NULL,
        review_text TEXT,
        traveled_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO transport_lines (id) VALUES ('line-60');
      INSERT INTO users (id) VALUES ('user-1');
      INSERT INTO trip_logs VALUES ('trip-1', 'line-60', 'user-1', 4, 'Histórica', '2026-08-20', '2026-08-20T12:00:00.000Z');
    `);

    await migrateAnonymousAuthors(db);

    const columns = await db.execute('PRAGMA table_info(trip_logs)');
    expect(columns.rows.find((row) => row.name === 'user_id')?.notnull).toBe(0);
    expect(columns.rows.some((row) => row.name === 'anonymous_identity_id')).toBe(true);
    expect((await db.execute("SELECT review_text FROM trip_logs WHERE id = 'trip-1'")).rows[0]?.review_text).toBe('Histórica');

    await db.execute("INSERT INTO anonymous_identities VALUES ('anon-1', 'hash', 'Anon 23423fdsa', '#00c778', 'now', 'now')");
    await expect(db.execute("INSERT INTO trip_logs (id, line_id, user_id, anonymous_identity_id, rating, review_text, traveled_at, created_at) VALUES ('trip-2', 'line-60', NULL, 'anon-1', 5, 'Anónima', '2026-08-21', 'now')")).resolves.toBeDefined();
    await expect(db.execute("INSERT INTO trip_logs (id, line_id, user_id, anonymous_identity_id, rating, review_text, traveled_at, created_at) VALUES ('trip-3', 'line-60', 'user-1', 'anon-1', 5, NULL, '2026-08-21', 'now')")).rejects.toThrow();
  });

  it('agrega like y tags a reseñas existentes y admite una puntuación vacía', async () => {
    db = createTestDatabase();
    await db.executeMultiple(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE transport_lines (id TEXT PRIMARY KEY);
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE anonymous_identities (id TEXT PRIMARY KEY);
      CREATE TABLE trip_logs (
        id TEXT PRIMARY KEY, line_id TEXT NOT NULL REFERENCES transport_lines(id),
        user_id TEXT REFERENCES users(id), anonymous_identity_id TEXT REFERENCES anonymous_identities(id),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), review_text TEXT,
        traveled_at TEXT NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO transport_lines VALUES ('line-60');
      INSERT INTO users VALUES ('user-1');
      INSERT INTO trip_logs VALUES ('trip-1', 'line-60', 'user-1', NULL, 4, 'Histórica', '2026-08-20', 'now');
    `);

    await migrateTripReviewMetadata(db);

    const migrated = (await db.execute("SELECT rating, liked, tags_json FROM trip_logs WHERE id = 'trip-1'")).rows[0];
    expect(migrated).toMatchObject({ rating: 4, liked: 0, tags_json: '[]' });
    await expect(db.execute("INSERT INTO trip_logs VALUES ('trip-2', 'line-60', 'user-1', NULL, 0, NULL, 1, '[\"lluvia\"]', '2026-08-21', 'now')")).resolves.toBeDefined();
  });

  it('conserva cuentas y sesiones al volver opcional el email', async () => {
    db = createTestDatabase();
    await db.executeMultiple(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO users VALUES ('user-1', 'ana', 'ana@example.com', 'hash', 'now');
      INSERT INTO sessions VALUES ('token', 'user-1', 'mañana', 'now');
    `);

    await migrateUsersToOptionalEmail(db);

    const columns = await db.execute('PRAGMA table_info(users)');
    expect(columns.rows.find((row) => row.name === 'email')?.notnull).toBe(0);
    expect((await db.execute("SELECT email FROM users WHERE id = 'user-1'")).rows[0]?.email).toBe('ana@example.com');
    expect((await db.execute("SELECT user_id FROM sessions WHERE token_hash = 'token'")).rows[0]?.user_id).toBe('user-1');
    await expect(db.execute("INSERT INTO users VALUES ('user-2', 'beto', NULL, 'hash', 'now')")).resolves.toBeDefined();
  });
});
