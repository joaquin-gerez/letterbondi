import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { RealtimeTripEvent, TripLog } from '../shared/types.js';
import { clientAddress, originAllowed, sameAddress, trustedProxyAddress } from './security.js';

export function attachRealtime(server: Server, publicOrigin = process.env.PUBLIC_ORIGIN) {
  const trustedProxy = trustedProxyAddress();
  const connections = new Map<string, number>();
  const alive = new WeakSet<WebSocket>();
  const sockets = new WebSocketServer({
    server,
    path: '/api/live',
    maxPayload: 32 * 1024,
    verifyClient: ({ req }, done) => {
      const remote = req.socket.remoteAddress;
      const fromProxy = Boolean(trustedProxy && remote && sameAddress(remote, trustedProxy));
      const protocol = (req.socket as typeof req.socket & { encrypted?: boolean }).encrypted || (fromProxy && req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
      if (!originAllowed(req.headers.origin, req.headers.host, protocol, publicOrigin)) { done(false, 403, 'Origin rejected'); return; }
      const ip = clientAddress(remote, req.headers['x-forwarded-for'], trustedProxy);
      if (sockets.clients.size >= 1000 || (connections.get(ip) ?? 0) >= 20) { done(false, 429, 'Too many connections'); return; }
      done(true);
    },
  });
  sockets.on('connection', (client, req) => {
    const ip = clientAddress(req.socket.remoteAddress, req.headers['x-forwarded-for'], trustedProxy);
    connections.set(ip, (connections.get(ip) ?? 0) + 1);
    alive.add(client);
    client.on('pong', () => alive.add(client));
    client.on('close', () => {
      const remaining = (connections.get(ip) ?? 1) - 1;
      if (remaining) connections.set(ip, remaining); else connections.delete(ip);
    });
  });
  const heartbeat = setInterval(() => {
    for (const client of sockets.clients) {
      if (!alive.has(client)) { client.terminate(); continue; }
      alive.delete(client);
      if (client.readyState === WebSocket.OPEN) client.ping();
    }
  }, 30_000);
  heartbeat.unref();

  return {
    publishTrip(trip: TripLog) {
      const event: RealtimeTripEvent = { type: 'trip.created', trip };
      const payload = JSON.stringify(event);
      for (const client of sockets.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    },
    close() {
      clearInterval(heartbeat);
      for (const client of sockets.clients) client.terminate();
      return new Promise<void>((resolve, reject) => sockets.close((error) => error ? reject(error) : resolve()));
    },
  };
}
