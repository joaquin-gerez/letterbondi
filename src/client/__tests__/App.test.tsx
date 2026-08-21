import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const line = {
  id: 'amba-colectivo-60', slug: 'linea-60-amba', name: 'Línea 60', shortName: '60', mode: 'colectivo',
  operator: 'MONSA', color: '#c83431', textColor: '#ffffff', origin: 'Constitución', destination: 'Tigre',
  city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina', sourceUrl: 'https://datos.gob.ar',
  sourceUpdatedAt: null, averageRating: null, logCount: 0,
};

const trolleybus = {
  ...line,
  id: 'rosario-trolebus-k', slug: 'trolebus-k', name: 'Trolebús K', shortName: 'K', mode: 'trolebus',
  operator: 'Movi', city: 'Rosario', province: 'Santa Fe',
};

function response(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

beforeEach(() => vi.stubGlobal('WebSocket', undefined));
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('renderiza únicamente datos entregados por la API', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/lines') return response([line, trolleybus]);
      if (url === '/api/trips') return response([]);
      if (url === '/api/stats') return response({ lineCount: 1, logCount: 0, userCount: 0, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: null });
      return response({ error: 'Ruta no encontrada' }, 404);
    }));
    render(<App />);
    expect(await screen.findByText('Línea 60')).toBeInTheDocument();
    expect(screen.queryByText('Línea 152')).not.toBeInTheDocument();
    expect(screen.queryByText('Trolebús K')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Filtrar por modo' })).queryByRole('button', { name: 'Trolebuses' })).not.toBeInTheDocument();
    expect(screen.getByText('Todavía no hay reseñas.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Línea 60').closest('button')!);
    expect(screen.getByRole('button', { name: 'Reseñar Línea 60' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtrar por modo' })).getByRole('button', { name: 'Trenes' }));
    expect(screen.queryByRole('button', { name: 'Reseñar Línea 60' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar línea, ciudad u operador'), { target: { value: 'inexistente' } });
    expect(screen.getByText('No encontramos servicios con esos filtros.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar filtros' }));
    expect(screen.getByPlaceholderText('Buscar línea, ciudad u operador')).toHaveValue('');
    expect(screen.getByText('Línea 60')).toBeInTheDocument();
  });

  it('pagina el catálogo de a 20 sin acumular resultados', async () => {
    const manyLines = Array.from({ length: 21 }, (_, index) => ({
      ...line,
      id: `line-${index + 1}`,
      slug: `linea-${index + 1}`,
      name: `Línea ${index + 1}`,
      shortName: String(index + 1),
    }));
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/lines') return response(manyLines);
      if (url === '/api/trips') return response([]);
      if (url === '/api/stats') return response({ lineCount: 21, logCount: 0, userCount: 0, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: null });
      return response({ error: 'Ruta no encontrada' }, 404);
    }));

    render(<App />);
    expect(await screen.findByText('Línea 20')).toBeInTheDocument();
    expect(screen.queryByText('Línea 21')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Páginas del catálogo' })).getByRole('button', { name: 'Página 2' }));
    expect(screen.getByText('Línea 21')).toBeInTheDocument();
    expect(screen.queryByText('Línea 1')).not.toBeInTheDocument();
  });

  it('muestra un error verificable si el backend no responde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin conexión'))));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con la API');
    await waitFor(() => expect(screen.queryByText('Línea 60')).not.toBeInTheDocument());
  });

  it('deja armar el viaje anónimamente y pide cuenta sólo al intentar guardarlo', async () => {
    const trip = {
      id: 'trip-1', rating: 4, reviewText: 'Buen viaje', liked: true, tags: ['hora pico'], traveledAt: '2026-08-20', createdAt: '2026-08-20T12:00:00.000Z',
      user: { id: 'user-1', username: 'anonimo', kind: 'registered' as const, color: null },
      line: { id: line.id, slug: line.slug, name: line.name, shortName: line.shortName, color: line.color, textColor: line.textColor, city: line.city, province: line.province },
    };
    let saved = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/lines') return response([line]);
      if (url === '/api/trips' && init?.method === 'POST') { saved = true; return response(trip, 201); }
      if (url === '/api/trips') return response(saved ? [trip] : []);
      if (url === '/api/stats') return response({ lineCount: 1, logCount: saved ? 1 : 0, userCount: saved ? 1 : 0, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: null });
      if (url === '/api/auth/register') return response({ user: { id: 'user-1', username: 'anonimo', email: null } }, 201);
      if (url === '/api/users/anonimo') return response({ user: trip.user, trips: [trip] });
      return response({ error: 'Ruta no encontrada' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await screen.findByText('Línea 60');

    fireEvent.click(screen.getByRole('button', { name: 'Reseñar un viaje' }));
    expect(screen.getByRole('dialog', { name: 'Reseñar un viaje' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Ingresar' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Servicio' }), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('option', { name: /Línea 60/ }));
    fireEvent.click(screen.getByRole('radio', { name: '4 de 5' }));
    fireEvent.change(screen.getByRole('textbox', { name: /^Reseña/ }), { target: { value: 'Buen viaje' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar reseña' }));

    expect(await screen.findByRole('dialog', { name: 'Ingresar' })).toBeInTheDocument();
    expect(saved).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'No tengo cuenta, registrarme' }));
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'anonimo' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Reseña guardada en tu perfil.');
    expect(saved).toBe(true);
    expect(fetchMock.mock.calls.findIndex(([url]) => String(url) === '/api/auth/register')).toBeLessThan(fetchMock.mock.calls.findIndex(([url, init]) => String(url) === '/api/trips' && (init as RequestInit | undefined)?.method === 'POST'));
  });
});
