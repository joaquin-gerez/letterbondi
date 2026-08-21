import type { AuthInput, CreateTripInput, MemberSummary, PlatformStats, ProfileResponse, SessionUser, TransportLine, TripLog } from '../shared/types';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('No pudimos conectar con la API. Recargá la página y volvé a intentar.', 0);
  }
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
  me: () => request<{ user: SessionUser | null; anonymousId: string | null }>('/api/auth/me'),
  members: () => request<MemberSummary[]>('/api/members'),
  profile: (username: string) => request<ProfileResponse>(`/api/users/${encodeURIComponent(username)}`),
  follow: (username: string) => request<{ following: true }>(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' }),
  unfollow: (username: string) => request<{ following: false }>(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' }),
  register: (input: AuthInput) => request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: AuthInput) => request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  deleteAccount: () => request<void>('/api/auth/account', { method: 'DELETE' }),
  createTrip: (input: CreateTripInput) => request<TripLog>('/api/trips', { method: 'POST', body: JSON.stringify(input) }),
  deleteTrip: (id: string) => request<void>(`/api/trips/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
