import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { Database } from './db/index.js';
import { addTrip, countRecentAnonymousTrips, createUser, deleteTrip, deleteUser, findPublicUser, findUserByUsername, getDatabase, getLine, getProfile, getStats, listLines, listMembers, listTrips, setFollowing } from './db/index.js';
import { createSession, currentAnonymousIdentity, currentUser, destroySession, getOrCreateAnonymousIdentity, hashPassword, verifyPassword } from './auth.js';
import { loginSchema, registerSchema, tripSchema, validationMessage } from './validation.js';
import { openApiDocument } from './openapi.js';
import type { TripLog } from '../shared/types.js';
import { createRateLimiter, originAllowed, sameAddress, trustedProxyAddress } from './security.js';

interface AppOptions {
  secureCookies?: boolean;
  onTripCreated?: (trip: TripLog) => void;
  adminToken?: string;
  publicOrigin?: string;
}

export function createApp(customDb?: Database, options: AppOptions = {}): Express {
  const app = express();
  const db = customDb ?? getDatabase();
  const secureCookies = options.secureCookies ?? process.env.COOKIE_SECURE === 'true';
  const trustedProxy = trustedProxyAddress();
  const adminToken = options.adminToken ?? (process.env.ADMIN_TOKEN?.trim() || undefined);
  const publicOrigin = options.publicOrigin ?? process.env.PUBLIC_ORIGIN;
  const loginLimit = createRateLimiter(10, 15 * 60_000);
  const registerLimit = createRateLimiter(10, 60 * 60_000);
  const tripLimit = createRateLimiter(20, 10 * 60_000);

  if (adminToken && adminToken.length < 32) throw new Error('ADMIN_TOKEN debe tener al menos 32 caracteres');

  app.disable('x-powered-by');
  if (trustedProxy) app.set('trust proxy', (ip: string, index: number) => index === 0 && sameAddress(ip, trustedProxy));
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      'img-src': ["'self'", 'data:'],
      'upgrade-insecure-requests': secureCookies ? [] : null,
    } },
    strictTransportSecurity: secureCookies ? undefined : false,
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/users')) res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const fetchSite = req.headers['sec-fetch-site'];
      if (fetchSite === 'cross-site' || !originAllowed(req.get('origin'), req.get('host'), req.protocol, publicOrigin)) {
        res.status(403).json({ error: 'Origen de solicitud rechazado' });
        return;
      }
    }
    next();
  });

  function rateLimited(check: ReturnType<typeof createRateLimiter>, key: string, res: Response): boolean {
    const retryAfter = check(key);
    if (!retryAfter) return false;
    res.set('Retry-After', String(retryAfter)).status(429).json({ error: 'Demasiadas solicitudes; intentá nuevamente más tarde' });
    return true;
  }

  function requestIp(req: Request): string {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }

  function isAdmin(req: Request): boolean {
    if (!adminToken) return false;
    const match = /^Bearer ([^\s]+)$/.exec(req.get('authorization') ?? '');
    if (!match) return false;
    const expected = createHash('sha256').update(adminToken).digest();
    const provided = createHash('sha256').update(match[1]!).digest();
    return timingSafeEqual(expected, provided);
  }

  app.get('/api/health', async (_req, res, next) => {
    try { await db.execute('SELECT 1'); res.json({ status: 'ok' }); }
    catch (error) { next(error); }
  });
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));

  app.get('/api/lines', async (req, res, next) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
      const province = typeof req.query.province === 'string' ? req.query.province : undefined;
      res.json(await listLines(db, { q, mode, province }));
    } catch (error) { next(error); }
  });

  app.get('/api/lines/:idOrSlug', async (req, res, next) => {
    try {
      const line = await getLine(db, String(req.params.idOrSlug));
      if (!line) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }
      res.json(line);
    } catch (error) { next(error); }
  });

  app.get('/api/trips', async (req, res, next) => {
    try {
      const lineId = typeof req.query.lineId === 'string' ? req.query.lineId : undefined;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(await listTrips(db, { lineId, limit: Number.isFinite(limit) ? limit : undefined }));
    } catch (error) { next(error); }
  });

  app.post('/api/trips', async (req, res, next) => {
    try {
      if (rateLimited(tripLimit, `ip:${requestIp(req)}`, res)) return;
      const user = await currentUser(db, req);
      const parsed = tripSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: validationMessage(parsed.error) }); return; }
      if (!await getLine(db, parsed.data.lineId)) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }
      if (user) {
        if (rateLimited(tripLimit, `user:${user.id}`, res)) return;
        const trip = await addTrip(db, { userId: user.id }, parsed.data);
        options.onTripCreated?.(trip);
        res.status(201).json(trip);
        return;
      }

      const anonymous = await getOrCreateAnonymousIdentity(db, req, res, secureCookies);
      if (rateLimited(tripLimit, `anonymous:${anonymous.id}`, res)) return;
      const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      if (await countRecentAnonymousTrips(db, anonymous.id, tenMinutesAgo) >= 3) {
        res.status(429).json({ error: 'Esperá unos minutos antes de publicar otra reseña anónima' });
        return;
      }
      const trip = await addTrip(db, { anonymousIdentityId: anonymous.id }, parsed.data);
      options.onTripCreated?.(trip);
      res.status(201).json(trip);
    } catch (error) { next(error); }
  });

  app.delete('/api/trips/:id', async (req, res, next) => {
    try {
      const admin = isAdmin(req);
      const user = admin ? null : await currentUser(db, req);
      const anonymous = admin ? null : await currentAnonymousIdentity(db, req);
      const id = String(req.params.id);
      const deleted = admin
        ? await deleteTrip(db, id, null, true)
        : (user ? await deleteTrip(db, id, { userId: user.id }, false) : false)
          || (anonymous ? await deleteTrip(db, id, { anonymousIdentityId: anonymous.id }, false) : false);
      if (!deleted) {
        res.status(404).json({ error: 'Viaje no encontrado' });
        return;
      }
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const identity = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : 'invalid';
      const ip = requestIp(req);
      if (rateLimited(registerLimit, `ip:${ip}`, res) || rateLimited(registerLimit, `ip:${ip}:username:${identity}`, res)) return;
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: validationMessage(parsed.error) }); return; }
      const user = await createUser(db, { username: parsed.data.username, passwordHash: await hashPassword(parsed.data.password) });
      await createSession(db, res, user.id, secureCookies);
      res.status(201).json({ user });
    } catch (error) {
      if (String(error).includes('UNIQUE')) { res.status(409).json({ error: 'Ese usuario ya está registrado' }); return; }
      next(error);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const identity = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : 'invalid';
      const ip = requestIp(req);
      if (rateLimited(loginLimit, `ip:${ip}`, res) || rateLimited(loginLimit, `ip:${ip}:username:${identity}`, res)) return;
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: validationMessage(parsed.error) }); return; }
      const user = await findUserByUsername(db, parsed.data.username);
      if (!user || !await verifyPassword(parsed.data.password, user.passwordHash)) {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' }); return;
      }
      await createSession(db, res, user.id, secureCookies);
      const { passwordHash: _passwordHash, ...publicUser } = user;
      res.json({ user: publicUser });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    try { await destroySession(db, req, res, secureCookies); res.status(204).end(); }
    catch (error) { next(error); }
  });

  app.delete('/api/auth/account', async (req, res, next) => {
    try {
      const user = await currentUser(db, req);
      if (!user) { res.status(401).json({ error: 'Ingresá para eliminar tu cuenta' }); return; }
      await deleteUser(db, user.id);
      await destroySession(db, req, res, secureCookies);
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.get('/api/auth/me', async (req, res, next) => {
    try {
      const [user, anonymous] = await Promise.all([currentUser(db, req), currentAnonymousIdentity(db, req)]);
      res.json({ user, anonymousId: anonymous?.id ?? null });
    }
    catch (error) { next(error); }
  });

  app.get('/api/members', async (_req, res, next) => {
    try { res.json(await listMembers(db)); }
    catch (error) { next(error); }
  });

  app.get('/api/users/:username', async (req, res, next) => {
    try {
      const viewer = await currentUser(db, req);
      const profile = await getProfile(db, String(req.params.username), viewer?.id);
      if (!profile) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
      res.json(profile);
    } catch (error) { next(error); }
  });

  app.post('/api/users/:username/follow', async (req, res, next) => {
    try {
      const viewer = await currentUser(db, req);
      if (!viewer) { res.status(401).json({ error: 'Ingresá para seguir miembros' }); return; }
      const target = await findPublicUser(db, String(req.params.username));
      if (!target) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
      if (target.id === viewer.id) { res.status(400).json({ error: 'No podés seguirte a vos mismo' }); return; }
      await setFollowing(db, viewer.id, target.id, true);
      res.json({ following: true });
    } catch (error) { next(error); }
  });

  app.delete('/api/users/:username/follow', async (req, res, next) => {
    try {
      const viewer = await currentUser(db, req);
      if (!viewer) { res.status(401).json({ error: 'Ingresá para dejar de seguir miembros' }); return; }
      const target = await findPublicUser(db, String(req.params.username));
      if (!target) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
      await setFollowing(db, viewer.id, target.id, false);
      res.json({ following: false });
    } catch (error) { next(error); }
  });

  app.get('/api/stats', async (_req, res, next) => {
    try { res.json(await getStats(db)); }
    catch (error) { next(error); }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  const clientDir = path.join(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir, {
      index: false, maxAge: '1y', immutable: true,
      setHeaders: (res, file) => { if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); },
    }));
    app.get('*splat', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { next(); return; }
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
