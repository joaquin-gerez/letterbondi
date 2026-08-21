import { createClient, type Client } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import type { CreateTripInput, PlatformStats, ProfileResponse, PublicUser, SessionUser, TransportLine, TransportMode, TripLog } from '../../shared/types.js';
import { INITIAL_LINES } from '../../shared/data/initialLines.js';
import { CREATE_SCHEMA, MIGRATE_TRIP_LOGS_TO_ANONYMOUS_AUTHORS, MIGRATE_TRIP_LOGS_TO_REVIEW_METADATA, MIGRATE_USERS_TO_OPTIONAL_EMAIL } from './schema.js';

export type Database = Client;

export interface AnonymousIdentity {
  id: string;
  username: string;
  color: string;
}

type TripAuthor =
  | { userId: string; anonymousIdentityId?: never }
  | { userId?: never; anonymousIdentityId: string };

let singleton: Client | null = null;

export function getDatabase(url = process.env.DATABASE_URL ?? 'file:letterbondi.db'): Client {
  if (!singleton) singleton = createClient({ url });
  return singleton;
}

export function createTestDatabase(): Client {
  return createClient({ url: ':memory:' });
}

async function runForeignKeyMigration(db: Client, sql: string): Promise<void> {
  await db.execute('PRAGMA foreign_keys = OFF');
  try {
    await db.executeMultiple(sql);
  } catch (error) {
    await db.execute('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await db.execute('PRAGMA foreign_keys = ON');
  }
}

export async function migrateUsersToOptionalEmail(db: Client): Promise<void> {
  const columns = await db.execute('PRAGMA table_info(users)');
  const emailColumn = columns.rows.find((row) => String(row.name) === 'email');
  if (Number(emailColumn?.notnull ?? 0) === 1) await runForeignKeyMigration(db, MIGRATE_USERS_TO_OPTIONAL_EMAIL);
}

export async function migrateAnonymousAuthors(db: Client): Promise<void> {
  const tripColumns = await db.execute('PRAGMA table_info(trip_logs)');
  const userIdColumn = tripColumns.rows.find((row) => String(row.name) === 'user_id');
  const hasAnonymousAuthor = tripColumns.rows.some((row) => String(row.name) === 'anonymous_identity_id');
  if (!hasAnonymousAuthor || Number(userIdColumn?.notnull ?? 0) === 1) {
    await runForeignKeyMigration(db, MIGRATE_TRIP_LOGS_TO_ANONYMOUS_AUTHORS);
  }
  await db.execute('CREATE INDEX IF NOT EXISTS idx_trip_logs_anonymous_identity_id ON trip_logs(anonymous_identity_id)');
}

export async function migrateTripReviewMetadata(db: Client): Promise<void> {
  const columns = await db.execute('PRAGMA table_info(trip_logs)');
  const hasLiked = columns.rows.some((row) => String(row.name) === 'liked');
  const hasTags = columns.rows.some((row) => String(row.name) === 'tags_json');
  if (!hasLiked || !hasTags) await runForeignKeyMigration(db, MIGRATE_TRIP_LOGS_TO_REVIEW_METADATA);
}

export async function initDatabase(db: Client): Promise<void> {
  await db.executeMultiple(CREATE_SCHEMA);
  await migrateUsersToOptionalEmail(db);
  await migrateAnonymousAuthors(db);
  await migrateTripReviewMetadata(db);
  await db.batch(
    INITIAL_LINES.map((line) => ({
      sql: `INSERT INTO transport_lines (
        id, slug, name, short_name, mode, operator, color, text_color, origin,
        destination, city, province, source_name, source_url, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug, name = excluded.name, short_name = excluded.short_name,
        mode = excluded.mode, operator = excluded.operator, color = excluded.color,
        text_color = excluded.text_color, origin = excluded.origin,
        destination = excluded.destination, city = excluded.city,
        province = excluded.province, source_name = excluded.source_name,
        source_url = excluded.source_url, source_updated_at = excluded.source_updated_at`,
      args: [line.id, line.slug, line.name, line.shortName, line.mode, line.operator, line.color, line.textColor, line.origin, line.destination, line.city, line.province, line.sourceName, line.sourceUrl, line.sourceUpdatedAt],
    })),
    'write',
  );
}

function mapLine(row: Record<string, unknown>): TransportLine {
  const average = row.average_rating;
  return {
    id: String(row.id), slug: String(row.slug), name: String(row.name), shortName: String(row.short_name),
    mode: row.mode as TransportMode, operator: row.operator ? String(row.operator) : null,
    color: String(row.color), textColor: String(row.text_color), origin: row.origin ? String(row.origin) : null,
    destination: row.destination ? String(row.destination) : null, city: String(row.city), province: String(row.province),
    sourceName: String(row.source_name), sourceUrl: String(row.source_url),
    sourceUpdatedAt: row.source_updated_at ? String(row.source_updated_at) : null,
    averageRating: average === null || average === undefined ? null : Number(average),
    logCount: Number(row.log_count ?? 0),
  };
}

function mapTrip(row: Record<string, unknown>): TripLog {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(row.tags_json ?? '[]'));
    if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch { tags = []; }
  return {
    id: String(row.id),
    line: {
      id: String(row.line_id), slug: String(row.line_slug), name: String(row.line_name),
      shortName: String(row.line_short_name), color: String(row.line_color), textColor: String(row.line_text_color),
      city: String(row.line_city), province: String(row.line_province),
    },
    user: {
      id: String(row.author_id), username: String(row.author_name),
      kind: row.author_kind === 'anonymous' ? 'anonymous' : 'registered',
      color: row.author_color ? String(row.author_color) : null,
    },
    rating: Number(row.rating), reviewText: row.review_text ? String(row.review_text) : null,
    liked: Number(row.liked ?? 0) === 1, tags,
    traveledAt: String(row.traveled_at), createdAt: String(row.created_at),
  };
}

const LINE_SELECT = `SELECT l.*, ROUND(AVG(NULLIF(t.rating, 0)), 1) AS average_rating, COUNT(t.id) AS log_count
  FROM transport_lines l LEFT JOIN trip_logs t ON t.line_id = l.id`;

export async function listLines(db: Client, filters: { q?: string; mode?: string; province?: string }): Promise<TransportLine[]> {
  const clauses: string[] = [];
  const args: Array<string> = [];
  if (filters.q) {
    clauses.push('(l.name LIKE ? OR l.short_name LIKE ? OR l.city LIKE ? OR l.province LIKE ? OR l.operator LIKE ?)');
    const term = `%${filters.q.trim()}%`;
    args.push(term, term, term, term, term);
  }
  if (filters.mode) { clauses.push('l.mode = ?'); args.push(filters.mode); }
  if (filters.province) { clauses.push('l.province = ?'); args.push(filters.province); }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.execute({ sql: `${LINE_SELECT}${where} GROUP BY l.id ORDER BY log_count DESC, l.province, l.name`, args });
  return result.rows.map((row) => mapLine(row as Record<string, unknown>));
}

export async function getLine(db: Client, idOrSlug: string): Promise<TransportLine | null> {
  const result = await db.execute({ sql: `${LINE_SELECT} WHERE l.id = ? OR l.slug = ? GROUP BY l.id`, args: [idOrSlug, idOrSlug] });
  return result.rows[0] ? mapLine(result.rows[0] as Record<string, unknown>) : null;
}

const TRIP_SELECT = `SELECT t.*, COALESCE(u.id, a.id) AS author_id,
  COALESCE(u.username, a.display_name) AS author_name,
  CASE WHEN t.user_id IS NOT NULL THEN 'registered' ELSE 'anonymous' END AS author_kind,
  a.color AS author_color, l.slug AS line_slug, l.name AS line_name,
  l.short_name AS line_short_name, l.color AS line_color, l.text_color AS line_text_color,
  l.city AS line_city, l.province AS line_province
  FROM trip_logs t
  LEFT JOIN users u ON u.id = t.user_id
  LEFT JOIN anonymous_identities a ON a.id = t.anonymous_identity_id
  JOIN transport_lines l ON l.id = t.line_id`;

export async function listTrips(db: Client, filters: { lineId?: string; userId?: string; limit?: number }): Promise<TripLog[]> {
  const clauses: string[] = [];
  const args: Array<string | number> = [];
  if (filters.lineId) { clauses.push('t.line_id = ?'); args.push(filters.lineId); }
  if (filters.userId) { clauses.push('t.user_id = ?'); args.push(filters.userId); }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  args.push(Math.min(Math.max(filters.limit ?? 30, 1), 100));
  const result = await db.execute({ sql: `${TRIP_SELECT}${where} ORDER BY t.created_at DESC LIMIT ?`, args });
  return result.rows.map((row) => mapTrip(row as Record<string, unknown>));
}

export async function addTrip(db: Client, author: TripAuthor, input: CreateTripInput): Promise<TripLog> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO trip_logs (
      id, line_id, user_id, anonymous_identity_id, rating, review_text, liked, tags_json, traveled_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.lineId, author.userId ?? null, author.anonymousIdentityId ?? null, input.rating, input.reviewText?.trim() || null, input.liked ? 1 : 0, JSON.stringify(input.tags ?? []), input.traveledAt, createdAt],
  });
  const result = await db.execute({ sql: `${TRIP_SELECT} WHERE t.id = ?`, args: [id] });
  return mapTrip(result.rows[0] as Record<string, unknown>);
}

export async function createAnonymousIdentity(db: Client, identity: { tokenHash: string; displayName: string; color: string }): Promise<AnonymousIdentity> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO anonymous_identities (id, token_hash, display_name, color, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, identity.tokenHash, identity.displayName, identity.color, now, now],
  });
  return { id, username: identity.displayName, color: identity.color };
}

export async function findAnonymousIdentityByTokenHash(db: Client, tokenHash: string): Promise<AnonymousIdentity | null> {
  const result = await db.execute({
    sql: 'SELECT id, display_name, color FROM anonymous_identities WHERE token_hash = ?',
    args: [tokenHash],
  });
  const row = result.rows[0];
  return row ? { id: String(row.id), username: String(row.display_name), color: String(row.color) } : null;
}

export async function touchAnonymousIdentity(db: Client, id: string): Promise<void> {
  await db.execute({ sql: 'UPDATE anonymous_identities SET last_seen_at = ? WHERE id = ?', args: [new Date().toISOString(), id] });
}

export async function countRecentAnonymousTrips(db: Client, anonymousIdentityId: string, since: string): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS total FROM trip_logs WHERE anonymous_identity_id = ? AND created_at >= ?',
    args: [anonymousIdentityId, since],
  });
  return Number(result.rows[0]?.total ?? 0);
}

export async function createUser(db: Client, user: { username: string; email?: string | null; passwordHash: string }): Promise<SessionUser> {
  const id = randomUUID();
  const email = user.email ?? null;
  await db.execute({ sql: 'INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', args: [id, user.username, email, user.passwordHash, new Date().toISOString()] });
  return { id, username: user.username, email };
}

export async function findUserByUsername(db: Client, username: string): Promise<(SessionUser & { passwordHash: string }) | null> {
  const result = await db.execute({ sql: 'SELECT id, username, email, password_hash FROM users WHERE username = ?', args: [username] });
  const row = result.rows[0];
  return row ? { id: String(row.id), username: String(row.username), email: row.email ? String(row.email) : null, passwordHash: String(row.password_hash) } : null;
}

export async function findPublicUser(db: Client, username: string): Promise<PublicUser | null> {
  const result = await db.execute({ sql: 'SELECT id, username FROM users WHERE username = ?', args: [username] });
  const row = result.rows[0];
  return row ? { id: String(row.id), username: String(row.username) } : null;
}

export async function saveSession(db: Client, tokenHash: string, userId: string, expiresAt: string): Promise<void> {
  await db.execute({ sql: 'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', args: [tokenHash, userId, expiresAt, new Date().toISOString()] });
}

export async function findSessionUser(db: Client, tokenHash: string): Promise<SessionUser | null> {
  const result = await db.execute({
    sql: `SELECT u.id, u.username, u.email FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`, args: [tokenHash, new Date().toISOString()],
  });
  const row = result.rows[0];
  return row ? { id: String(row.id), username: String(row.username), email: row.email ? String(row.email) : null } : null;
}

export async function deleteSession(db: Client, tokenHash: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [tokenHash] });
}

export async function getProfile(db: Client, username: string): Promise<ProfileResponse | null> {
  const user = await findPublicUser(db, username);
  if (!user) return null;
  return { user, trips: await listTrips(db, { userId: user.id, limit: 100 }) };
}

export async function getStats(db: Client): Promise<PlatformStats> {
  const result = await db.execute(`SELECT
    (SELECT COUNT(*) FROM transport_lines) AS line_count,
    (SELECT COUNT(*) FROM trip_logs) AS log_count,
    (SELECT COUNT(*) FROM users) AS user_count,
    (SELECT COUNT(DISTINCT province) FROM transport_lines) AS province_count`);
  const row = result.rows[0];
  return { lineCount: Number(row?.line_count ?? 0), logCount: Number(row?.log_count ?? 0), userCount: Number(row?.user_count ?? 0), provinceCount: Number(row?.province_count ?? 0) };
}
