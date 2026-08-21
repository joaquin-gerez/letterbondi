// @vitest-environment node
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { TripLog } from '../../shared/types.js';
import { attachRealtime } from '../realtime.js';

describe('actividad en tiempo real', () => {
  let server: Server;
  let realtime: ReturnType<typeof attachRealtime>;
  let port: number;

  beforeAll(async () => {
    server = createServer();
    realtime = attachRealtime(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo abrir el servidor de prueba');
    port = address.port;
  });

  afterAll(async () => {
    await realtime.close();
    server.close();
    await once(server, 'close');
  });

  it('publica una reseña nueva a los clientes conectados', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}/api/live`);
    await once(client, 'open');
    const message = once(client, 'message');
    const trip: TripLog = {
      id: 'trip-live', rating: 5, reviewText: 'Llegó impecable.', liked: true, tags: [], traveledAt: '2026-08-21', createdAt: '2026-08-21T12:00:00.000Z',
      user: { id: 'anon-live', username: 'Anon oculto', kind: 'anonymous', color: '#3a78a6' },
      line: { id: 'line-60', slug: 'linea-60', name: 'Línea 60', shortName: '60', color: '#c83431', textColor: '#ffffff', city: 'AMBA', province: 'Buenos Aires' },
    };

    realtime.publishTrip(trip);
    const [payload] = await message;
    expect(JSON.parse(String(payload))).toEqual({ type: 'trip.created', trip });
    client.close();
    await once(client, 'close');
  });
});
