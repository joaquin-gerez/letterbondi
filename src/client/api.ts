import type { AuthInput, CreateTripInput, PlatformStats, ProfileResponse, SessionUser, TransportLine, TripLog } from '../shared/types';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'No pudimos completar la solicitud' }));
    throw new ApiError(String(body.error ?? 'No pudimos completar la solicitud'), response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  lines: () => request<TransportLine[]>('/api/lines'),
  trips: (lineId?: string) => request<TripLog[]>(`/api/trips${lineId ? `?lineId=${encodeURIComponent(lineId)}` : ''}`),
  stats: () => request<PlatformStats>('/api/stats'),
  me: () => request<{ user: SessionUser | null }>('/api/auth/me'),
  profile: (username: string) => request<ProfileResponse>(`/api/users/${encodeURIComponent(username)}`),
  register: (input: AuthInput) => request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: AuthInput) => request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  createTrip: (input: CreateTripInput) => request<TripLog>('/api/trips', { method: 'POST', body: JSON.stringify(input) }),
};
