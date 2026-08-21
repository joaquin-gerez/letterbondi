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

  it('traduce un fallo de red a un mensaje accionable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.me()).rejects.toMatchObject({ message: 'No pudimos conectar con la API. Recargá la página y volvé a intentar.', status: 0 });
  });

  it('acepta respuestas 204 sin intentar leer JSON', async () => {
    const json = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json } as unknown as Response));
    await expect(api.logout()).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});
