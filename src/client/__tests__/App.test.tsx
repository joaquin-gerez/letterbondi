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

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.stubGlobal('WebSocket', undefined);
  window.history.replaceState({}, '', '/');
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  scrollIntoView.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('renderiza únicamente datos entregados por la API', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/lines') return response([line, trolleybus]);
      if (url === '/api/trips' || url === `/api/trips?lineId=${line.id}`) return response([]);
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
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/trips?lineId=${line.id}`, expect.anything()));
    expect(screen.getByRole('dialog', { name: 'Línea 60' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Datos Argentina' })).toHaveAttribute('href', line.sourceUrl);
    expect(screen.getByRole('status')).toHaveTextContent('Estás viendo las reseñas de Línea 60');
    expect(screen.getByRole('button', { name: 'Ver todas las reseñas' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reseñar Línea 60' }));
    expect(screen.getByRole('dialog', { name: 'Reseñar Línea 60' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas las reseñas' }));
    expect(screen.queryByText('Estás viendo las reseñas de Línea 60')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtrar por modo' })).getByRole('button', { name: 'Trenes' }));
    expect(screen.queryByRole('button', { name: 'Reseñar Línea 60' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar línea, ciudad u operador'), { target: { value: 'inexistente' } });
    expect(screen.getByText('No encontramos servicios con esos filtros.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar filtros' }));
    expect(screen.getByPlaceholderText('Buscar línea, ciudad u operador')).toHaveValue('');
    expect(screen.getByText('Línea 60')).toBeInTheDocument();
  });

  it('pagina el catálogo de a 15 sin acumular resultados', async () => {
    const manyLines = Array.from({ length: 16 }, (_, index) => ({
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
      if (url === '/api/stats') return response({ lineCount: 16, logCount: 0, userCount: 0, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: null });
      return response({ error: 'Ruta no encontrada' }, 404);
    }));

    render(<App />);
    expect(await screen.findByText('Línea 15')).toBeInTheDocument();
    expect(screen.queryByText('Línea 16')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Páginas del catálogo' })).getByRole('button', { name: 'Página 2' }));
    expect(screen.getByText('Línea 16')).toBeInTheDocument();
    expect(screen.queryByText('Línea 1')).not.toBeInTheDocument();
  });

  it('ordena el catálogo por actividad, puntuación o nombre', async () => {
    const popular = { ...line, id: 'line-20', slug: 'linea-20', name: 'Línea 20', shortName: '20', averageRating: 2, logCount: 10 };
    const rated = { ...line, id: 'line-10', slug: 'linea-10', name: 'Línea 10', shortName: '10', averageRating: 5, logCount: 1 };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/lines') return response([rated, popular]);
      if (url === '/api/trips') return response([]);
      if (url === '/api/stats') return response({ lineCount: 2, logCount: 11, userCount: 0, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: null, anonymousId: null });
      return response({ error: 'Ruta no encontrada' }, 404);
    }));
    render(<App />);
    const firstCard = () => within(document.querySelector('.line-list')!).getAllByRole('button')[0];
    await screen.findByText('Línea 20');
    expect(firstCard()).toHaveTextContent('Línea 20');
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar servicios' }), { target: { value: 'rating' } });
    expect(firstCard()).toHaveTextContent('Línea 10');
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar servicios' }), { target: { value: 'name' } });
    expect(firstCard()).toHaveTextContent('Línea 10');
  });

  it('muestra un error verificable si el backend no responde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin conexión'))));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con la API');
    await waitFor(() => expect(screen.queryByText('Línea 60')).not.toBeInTheDocument());
  });

  it('muestra una página 404 para rutas desconocidas', () => {
    window.history.replaceState({}, '', '/recorrido-inventado');
    vi.stubGlobal('fetch', vi.fn(() => response({ error: 'Ruta no encontrada' }, 404)));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Este recorrido no existe.' })).toBeInTheDocument();
  });

  it('muestra una página 404 para perfiles inexistentes', async () => {
    window.history.replaceState({}, '', '/profile/no-existe');
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/lines') return response([line]);
      if (url === '/api/trips') return response([]);
      if (url === '/api/stats') return response({ lineCount: 1, logCount: 0, userCount: 0, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: null, anonymousId: null });
      if (url === '/api/users/no-existe') return response({ error: 'Usuario no encontrado' }, 404);
      return response({ error: 'Ruta no encontrada' }, 404);
    }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Este recorrido no existe.' })).toBeInTheDocument();
  });

  it('navega al perfil con una URL real y sin el rótulo de archivo personal', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/lines') return response([line]);
      if (url === '/api/trips') return response([]);
      if (url === '/api/stats') return response({ lineCount: 1, logCount: 0, userCount: 1, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: { id: 'user-1', username: 'joako', email: null } });
      if (url === '/api/users/joako') return response({ user: { id: 'user-1', username: 'joako' }, trips: [], followerCount: 2, followingCount: 1, isFollowing: false });
      return response({ error: 'Ruta no encontrada' }, 404);
    }));

    render(<App />);
    fireEvent.click(await screen.findByText('@joako'));
    fireEvent.click(screen.getByRole('button', { name: 'Mi perfil' }));
    expect(window.location.pathname).toBe('/profile/joako');
    expect(await screen.findByRole('heading', { name: 'Diario de @joako' })).toBeInTheDocument();
    expect(screen.getByText('2').closest('span')).toHaveTextContent('2 seguidores');
    expect(screen.queryByText('Archivo personal')).not.toBeInTheDocument();
  });

  it('lista miembros, abre un perfil público y permite seguirlo', async () => {
    const member = { id: 'user-2', username: 'marta', reviewCount: 3, followerCount: 1, followingCount: 0 };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/lines') return response([line]);
      if (url === '/api/trips') return response([]);
      if (url === '/api/stats') return response({ lineCount: 1, logCount: 3, userCount: 2, provinceCount: 1 });
      if (url === '/api/auth/me') return response({ user: { id: 'user-1', username: 'joako', email: null } });
      if (url === '/api/members') return response([member]);
      if (url === '/api/users/marta' && init?.method === 'POST') return response({ following: true });
      if (url === '/api/users/marta') return response({ user: { id: member.id, username: member.username }, trips: [], followerCount: 1, followingCount: 0, isFollowing: false });
      if (url === '/api/users/marta/follow' && init?.method === 'POST') return response({ following: true });
      return response({ error: 'Ruta no encontrada' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Miembros' }));
    expect(window.location.pathname).toBe('/members');
    fireEvent.click(await screen.findByRole('button', { name: /@marta/ }));
    expect(window.location.pathname).toBe('/profile/marta');
    expect(await screen.findByRole('heading', { name: 'Diario de @marta' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/users/marta/follow', expect.objectContaining({ method: 'POST' }));
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
      if (url === '/api/users/anonimo') return response({ user: trip.user, trips: [trip], followerCount: 0, followingCount: 0, isFollowing: false });
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
