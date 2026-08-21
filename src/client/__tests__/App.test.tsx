import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const line = {
  id: 'amba-colectivo-60', slug: 'linea-60-amba', name: 'Línea 60', shortName: '60', mode: 'colectivo',
  operator: 'MONSA', color: '#c83431', textColor: '#ffffff', origin: 'Constitución', destination: 'Tigre',
  city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina', sourceUrl: 'https://datos.gob.ar',
  sourceUpdatedAt: null, averageRating: null, logCount: 0,
};

function response(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('renderiza únicamente datos entregados por la API', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/lines') return response([line]);
      if (url === '/api/trips') return response([]);
      if (url === '/api/stats') return response({ lineCount: 1, logCount: 0, userCount: 0, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: null });
      return response({ error: 'Ruta no encontrada' }, 404);
    }));
    render(<App />);
    expect(await screen.findByText('Línea 60')).toBeInTheDocument();
    expect(screen.queryByText('Línea 152')).not.toBeInTheDocument();
    expect(screen.getByText('El archivo todavía está vacío.')).toBeInTheDocument();
  });

  it('muestra un error verificable si el backend no responde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin conexión'))));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('sin conexión');
    await waitFor(() => expect(screen.queryByText('Línea 60')).not.toBeInTheDocument());
  });

  it('deja armar el viaje anónimamente y pide cuenta sólo al intentar guardarlo', async () => {
    const trip = {
      id: 'trip-1', rating: 4, reviewText: 'Buen viaje', traveledAt: '2026-08-20', createdAt: '2026-08-20T12:00:00.000Z',
      user: { id: 'user-1', username: 'anonimo' },
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
      if (url === '/api/auth/register') return response({ user: { id: 'user-1', username: 'anonimo', email: 'anonimo@example.com' } }, 201);
      if (url === '/api/users/anonimo') return response({ user: trip.user, trips: [trip] });
      return response({ error: 'Ruta no encontrada' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await screen.findByText('Línea 60');

    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar viaje' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Registrar viaje' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Ingresar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '4 de 5' }));
    fireEvent.change(screen.getByLabelText(/Reseña/), { target: { value: 'Buen viaje' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en mi diario' }));

    expect(await screen.findByRole('dialog', { name: '¿Te lo vas a tomar en serio?' })).toBeInTheDocument();
    expect(saved).toBe(false);
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'anonimo' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'anonimo@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Viaje guardado en tu diario.');
    expect(saved).toBe(true);
    expect(fetchMock.mock.calls.findIndex(([url]) => String(url) === '/api/auth/register')).toBeLessThan(fetchMock.mock.calls.findIndex(([url, init]) => String(url) === '/api/trips' && (init as RequestInit | undefined)?.method === 'POST'));
  });
});
