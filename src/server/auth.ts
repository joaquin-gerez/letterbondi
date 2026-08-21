import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Database } from './db/index.js';
import { deleteSession, findSessionUser, saveSession } from './db/index.js';

const COOKIE_NAME = 'letterbondi_session';
const SESSION_DAYS = 30;

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

function readCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === COOKIE_NAME) return decodeURIComponent(value.join('='));
  }
  return null;
}

export async function createSession(db: Database, res: Response, userId: string, secure: boolean): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await saveSession(db, hashToken(token), userId, expiresAt.toISOString());
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure, expires: expiresAt, path: '/' });
}

export async function currentUser(db: Database, req: Request) {
  const token = readCookie(req);
  return token ? findSessionUser(db, hashToken(token)) : null;
}

export async function destroySession(db: Database, req: Request, res: Response, secure: boolean): Promise<void> {
  const token = readCookie(req);
  if (token) await deleteSession(db, hashToken(token));
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}
