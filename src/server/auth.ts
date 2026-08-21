import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Database } from './db/index.js';
import { createAnonymousIdentity, deleteSession, findAnonymousIdentityByTokenHash, findSessionUser, saveSession, touchAnonymousIdentity, type AnonymousIdentity } from './db/index.js';

const SESSION_COOKIE_NAME = 'letterbondi_session';
const ANONYMOUS_COOKIE_NAME = 'letterbondi_anon';
const SESSION_DAYS = 30;
const ANONYMOUS_DAYS = 365;
const ANONYMOUS_COLORS = ['#ff7a1a', '#00c778', '#3aa6ff', '#ef476f', '#f2c14e', '#8f7cff', '#23b5a5', '#e4572e'];

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [saltHex, hashHex] = encoded.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(req: Request, cookieName: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === cookieName) return decodeURIComponent(value.join('='));
  }
  return null;
}

export async function createSession(db: Database, res: Response, userId: string, secure: boolean): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await saveSession(db, hashToken(token), userId, expiresAt.toISOString());
  res.cookie(SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure, expires: expiresAt, path: '/' });
}

export async function currentUser(db: Database, req: Request) {
  const token = readCookie(req, SESSION_COOKIE_NAME);
  return token ? findSessionUser(db, hashToken(token)) : null;
}

export async function currentAnonymousIdentity(db: Database, req: Request): Promise<AnonymousIdentity | null> {
  const token = readCookie(req, ANONYMOUS_COOKIE_NAME);
  return token ? findAnonymousIdentityByTokenHash(db, hashToken(token)) : null;
}

export async function destroySession(db: Database, req: Request, res: Response, secure: boolean): Promise<void> {
  const token = readCookie(req, SESSION_COOKIE_NAME);
  if (token) await deleteSession(db, hashToken(token));
  res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}

function anonymousSuffix(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(randomBytes(9), (byte) => alphabet[byte % alphabet.length]).join('');
}

export async function getOrCreateAnonymousIdentity(db: Database, req: Request, res: Response, secure: boolean): Promise<AnonymousIdentity> {
  const existingToken = readCookie(req, ANONYMOUS_COOKIE_NAME);
  if (existingToken) {
    const existing = await findAnonymousIdentityByTokenHash(db, hashToken(existingToken));
    if (existing) {
      await touchAnonymousIdentity(db, existing.id);
      return existing;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(32).toString('base64url');
    const color = ANONYMOUS_COLORS[randomBytes(1)[0]! % ANONYMOUS_COLORS.length]!;
    try {
      const identity = await createAnonymousIdentity(db, {
        tokenHash: hashToken(token), displayName: `Anon ${anonymousSuffix()}`, color,
      });
      const expires = new Date(Date.now() + ANONYMOUS_DAYS * 86_400_000);
      res.cookie(ANONYMOUS_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure, expires, path: '/' });
      return identity;
    } catch (error) {
      if (!String(error).includes('UNIQUE')) throw error;
    }
  }
  throw new Error('No pudimos asignar una identidad anónima');
}
