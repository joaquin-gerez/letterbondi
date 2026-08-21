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
    expect((await agent.get('/api/health')).body).toEqual({ status: 'ok' });
    const lines = await agent.get('/api/lines?province=Córdoba');
    expect(lines.status).toBe(200);
    expect(lines.body.length).toBeGreaterThan(0);
    expect(lines.body[0]).toMatchObject({ province: 'Córdoba' });
    const docs = await agent.get('/api/openapi.json');
    expect(docs.body.openapi).toBe('3.1.0');
  });

  it('rechaza viajes anónimos y datos inválidos', async () => {
    const anonymous = await request(createApp(db, { secureCookies: false })).post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 5, traveledAt: '2026-08-20' });
    expect(anonymous.status).toBe(401);

    await agent.post('/api/auth/register').send({ username: 'pasajero', email: 'p@example.com', password: 'contraseña-segura' });
    const invalid = await agent.post('/api/trips').send({ lineId: 'amba-colectivo-60', rating: 9, traveledAt: 'hoy' });
    expect(invalid.status).toBe(400);
  });

  it('registra una cuenta, conserva sesión y crea un viaje real', async () => {
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ username: 'pasajero' });

    const created = await agent.post('/api/trips').send({
      lineId: 'amba-colectivo-60', rating: 4, reviewText: 'Llegó a horario y viajé sentado.', traveledAt: '2026-08-20',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ rating: 4, user: { username: 'pasajero' }, line: { shortName: '60' } });

    const profile = await agent.get('/api/users/pasajero');
    expect(profile.body.trips).toHaveLength(1);
    expect(profile.body.trips[0].reviewText).toContain('horario');
  });

  it('no permite usuarios duplicados y permite cerrar sesión', async () => {
    const duplicate = await agent.post('/api/auth/register').send({ username: 'pasajero', email: 'otro@example.com', password: 'contraseña-segura' });
    expect(duplicate.status).toBe(409);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });
});
