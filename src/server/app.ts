import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import type { Database } from './db/index.js';
import { addTrip, countRecentAnonymousTrips, createUser, findPublicUser, findUserByUsername, getDatabase, getLine, getProfile, getStats, listLines, listMembers, listTrips, setFollowing } from './db/index.js';
import { createSession, currentUser, destroySession, getOrCreateAnonymousIdentity, hashPassword, verifyPassword } from './auth.js';
import { loginSchema, registerSchema, tripSchema, validationMessage } from './validation.js';
import { openApiDocument } from './openapi.js';
import type { TripLog } from '../shared/types.js';

interface AppOptions {
  secureCookies?: boolean;
  onTripCreated?: (trip: TripLog) => void;
}

export function createApp(customDb?: Database, options: AppOptions = {}): Express {
  const app = express();
  const db = customDb ?? getDatabase();
  const secureCookies = options.secureCookies ?? process.env.COOKIE_SECURE === 'true';

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      'img-src': ["'self'", 'data:'],
      'upgrade-insecure-requests': secureCookies ? [] : null,
    } },
    strictTransportSecurity: secureCookies ? undefined : false,
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['sec-fetch-site'] === 'cross-site') {
      res.status(403).json({ error: 'Solicitud cross-site rechazada' });
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
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
      const user = await currentUser(db, req);
      const parsed = tripSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: validationMessage(parsed.error) }); return; }
      if (!await getLine(db, parsed.data.lineId)) { res.status(404).json({ error: 'Servicio no encontrado' }); return; }
      if (user) {
        const trip = await addTrip(db, { userId: user.id }, parsed.data);
        options.onTripCreated?.(trip);
        res.status(201).json(trip);
        return;
      }

      const anonymous = await getOrCreateAnonymousIdentity(db, req, res, secureCookies);
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

  app.post('/api/auth/register', async (req, res, next) => {
    try {
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

  app.get('/api/auth/me', async (req, res, next) => {
    try { res.json({ user: await currentUser(db, req) }); }
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
    app.use(express.static(clientDir, { index: false, maxAge: '1y', immutable: true }));
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
