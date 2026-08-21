// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('cliente API', () => {
  it('codifica filtros y conserva cookies same-origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([]));
    vi.stubGlobal('fetch', fetchMock);
    await api.trips('line/a');
    expect(fetchMock).toHaveBeenCalledWith('/api/trips?lineId=line%2Fa', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('convierte errores HTTP en ApiError con mensaje y estado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'No autorizado' }, 401)));
    await expect(api.me()).rejects.toMatchObject({ message: 'No autorizado', status: 401 });
    await api.me().catch((error) => expect(error).toBeInstanceOf(ApiError));
  });

  it('acepta respuestas 204 sin intentar leer JSON', async () => {
    const json = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json } as unknown as Response));
    await expect(api.logout()).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});
