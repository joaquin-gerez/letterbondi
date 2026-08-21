// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createTestDatabase, initDatabase, type Database } from '../db/index.js';

describe('Letterbondi API', () => {
  let db: Database;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    db = createTestDatabase();
    await initDatabase(db);
    agent = request.agent(createApp(db, { secureCookies: false }));
  });

  afterAll(() => db.close());

  it('expone salud, catálogo nacional inicial y OpenAPI', async () => {
    const health = await agent.get('/api/health');
    expect(health.body).toEqual({ status: 'ok' });
    expect(health.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(health.headers['strict-transport-security']).toBeUndefined();
    const lines = await agent.get('/api/lines?province=Córdoba');
    expect(lines.status).toBe(200);
    expect(lines.body.length).toBeGreaterThan(0);
    expect(lines.body[0]).toMatchObject({ province: 'Córdoba' });
    const docs = await agent.get('/api/openapi.json');
    expect(docs.body.openapi).toBe('3.1.0');
  });

  it('asigna una identidad estable y limita las reseñas anónimas', async () => {
    const anonymousAgent = request.agent(createApp(db, { secureCookies: false }));
    const first = await anonymousAgent.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 5, reviewText: 'Primera anónima', liked: true, tags: ['hora pico'], traveledAt: '2026-08-20' });
    expect(first.status).toBe(201);
    expect(first.body.user).toMatchObject({ kind: 'anonymous' });
    expect(first.body.user.username).toMatch(/^Anon [a-z0-9]{9}$/);
    expect(first.body.user.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(first.body).toMatchObject({ liked: true, tags: ['hora pico'] });
    expect(first.headers['set-cookie']?.join(';')).toContain('letterbondi_anon=');
    expect(first.headers['set-cookie']?.join(';')).not.toContain('Secure');

    const second = await anonymousAgent.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 4, traveledAt: '2026-08-21' });
    const third = await anonymousAgent.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 3, traveledAt: '2026-08-21' });
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(third.status).toBe(201);
    const limited = await anonymousAgent.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 2, traveledAt: '2026-08-21' });
    expect(limited.status).toBe(429);
    expect((await anonymousAgent.get('/api/auth/me')).body.anonymousId).toBe(first.body.user.id);
    expect((await anonymousAgent.delete(`/api/trips/${first.body.id}`)).status).toBe(204);
    await anonymousAgent.post('/api/auth/register').send({ username: 'antesanonimo', password: 'contraseña-larga' });
    expect((await anonymousAgent.delete(`/api/trips/${second.body.id}`)).status).toBe(204);
  });

  it('rechaza datos inválidos aunque exista una sesión', async () => {
    await agent.post('/api/auth/register').send({ username: 'pasajero', password: 'contraseña-segura' });
    const invalid = await agent.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 9, traveledAt: 'hoy' });
    expect(invalid.status).toBe(400);
  });

  it('registra una cuenta, conserva sesión y crea un viaje real', async () => {
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ username: 'pasajero' });

    const created = await agent.post('/api/trips').send({
      lineId: 'amba-colectivo-60', rating: 4, reviewText: 'Llegó a horario y viajé sentado.', liked: true, tags: ['puntual'], traveledAt: '2026-08-20',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ rating: 4, user: { username: 'pasajero' }, line: { shortName: '60' } });

    const profile = await agent.get('/api/users/pasajero');
    expect(profile.body.trips).toHaveLength(1);
    expect(profile.body.trips[0].reviewText).toContain('horario');
    expect(profile.body.trips[0]).toMatchObject({ liked: true, tags: ['puntual'] });
  });

  it('no permite usuarios duplicados y permite cerrar sesión', async () => {
    const duplicate = await agent.post('/api/auth/register').send({ username: 'pasajero', password: 'contraseña-segura' });
    expect(duplicate.status).toBe(409);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await agent.post('/api/auth/login').send({ username: 'PASAJERO', password: 'contraseña-segura' })).status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user).toMatchObject({ username: 'pasajero', email: null });
  });

  it('lista perfiles y permite seguirlos sin duplicar relaciones', async () => {
    const otherAgent = request.agent(createApp(db, { secureCookies: false }));
    expect((await otherAgent.post('/api/auth/register').send({ username: 'marta', password: '1234567890' })).status).toBe(201);

    const members = await agent.get('/api/members');
    expect(members.status).toBe(200);
    expect(members.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ username: 'pasajero', reviewCount: 1 }),
      expect.objectContaining({ username: 'marta', reviewCount: 0, followerCount: 0 }),
    ]));

    expect((await agent.post('/api/users/marta/follow')).body).toEqual({ following: true });
    expect((await agent.post('/api/users/marta/follow')).body).toEqual({ following: true });
    const followedProfile = await agent.get('/api/users/marta');
    expect(followedProfile.body).toMatchObject({ followerCount: 1, isFollowing: true });
    expect((await agent.post('/api/users/pasajero/follow')).status).toBe(400);

    const anonymousAgent = request.agent(createApp(db, { secureCookies: false }));
    expect((await anonymousAgent.post('/api/users/marta/follow')).status).toBe(401);

    expect((await agent.delete('/api/users/marta/follow')).body).toEqual({ following: false });
    expect((await agent.get('/api/users/marta')).body).toMatchObject({ followerCount: 0, isFollowing: false });
  });

  it('aplica Origin, no-store y límites de autenticación', async () => {
    const securityAgent = request(createApp(db, { secureCookies: false }));
    expect((await securityAgent.post('/api/auth/login').set('Origin', 'https://evil.example').send({ username: 'nadie', password: 'incorrecta' })).status).toBe(403);
    expect((await securityAgent.get('/api/auth/me')).headers['cache-control']).toBe('no-store');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await securityAgent.post('/api/auth/login').send({ username: 'nadie', password: 'incorrecta' })).status).toBe(401);
    }
    const limited = await securityAgent.post('/api/auth/login').send({ username: 'nadie', password: 'incorrecta' });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('permite borrar viajes solo al autor o al token de moderación', async () => {
    const owner = request.agent(createApp(db, { secureCookies: false }));
    const outsider = request.agent(createApp(db, { secureCookies: false }));
    await owner.post('/api/auth/register').send({ username: 'propietario', password: 'contraseña-larga' });
    const first = await owner.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 5, traveledAt: '2026-08-21' });
    expect((await outsider.delete(`/api/trips/${first.body.id}`)).status).toBe(404);
    expect((await owner.delete(`/api/trips/${first.body.id}`)).status).toBe(204);

    const second = await owner.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 4, traveledAt: '2026-08-21' });
    const adminToken = 'a'.repeat(32);
    const moderator = request(createApp(db, { secureCookies: false, adminToken }));
    expect((await moderator.delete(`/api/trips/${second.body.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(204);
  });

  it('permite eliminar la cuenta y todo su contenido', async () => {
    const disposable = request.agent(createApp(db, { secureCookies: false }));
    await disposable.post('/api/auth/register').send({ username: 'descartable', password: 'contraseña-larga' });
    await disposable.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 4, traveledAt: '2026-08-21' });
    expect((await disposable.delete('/api/auth/account')).status).toBe(204);
    expect((await disposable.get('/api/auth/me')).body.user).toBeNull();
    expect((await disposable.get('/api/users/descartable')).status).toBe(404);
  });
});
