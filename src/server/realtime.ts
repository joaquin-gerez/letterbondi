import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { RealtimeTripEvent, TripLog } from '../shared/types.js';

export function attachRealtime(server: Server) {
  const sockets = new WebSocketServer({ server, path: '/api/live' });
  const heartbeat = setInterval(() => {
    for (const client of sockets.clients) {
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
      return new Promise<void>((resolve, reject) => sockets.close((error) => error ? reject(error) : resolve()));
    },
  };
}
