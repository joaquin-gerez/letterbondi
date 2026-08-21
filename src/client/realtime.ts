import type { RealtimeTripEvent, TripLog } from '../shared/types';

function liveUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/live`;
}

export function parseRealtimeTrip(data: unknown): TripLog | null {
  try {
    const event = JSON.parse(String(data)) as Partial<RealtimeTripEvent>;
    return event.type === 'trip.created' && event.trip?.id ? event.trip : null;
  } catch {
    return null;
  }
}

export function subscribeToTrips(onTrip: (trip: TripLog) => void) {
  if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') return () => {};

  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let stopped = false;

  function connect() {
    socket = new WebSocket(liveUrl());
    socket.addEventListener('message', (event) => {
      const trip = parseRealtimeTrip(event.data);
      if (trip) onTrip(trip);
    });
    socket.addEventListener('close', () => {
      if (!stopped) reconnectTimer = window.setTimeout(connect, 2_000);
    });
  }

  connect();
  return () => {
    stopped = true;
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}
