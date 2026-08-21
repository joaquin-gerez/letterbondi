import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransportLine, TripLog } from '../../shared/types';
import { api } from '../api';
import { anonymousColor, anonymousVariant } from '../components/AnonymousBadge';
import { AuthDialog } from '../components/AuthDialog';
import { Header } from '../components/Header';
import { lineCardColors, LineCard } from '../components/LineCard';
import { localDateValue, LogTripDialog } from '../components/LogTripDialog';
import { Modal } from '../components/Modal';
import { RatingInput } from '../components/RatingInput';
import { TripEntry } from '../components/TripEntry';

const line: TransportLine = {
  id: 'line-60', slug: 'linea-60', name: 'Línea 60', shortName: '60', mode: 'colectivo',
  operator: 'MONSA', color: '#c83431', textColor: '#ffffff', origin: 'Constitución', destination: 'Tigre',
  city: 'AMBA', province: 'Buenos Aires', sourceName: 'Datos Argentina', sourceUrl: 'https://datos.gob.ar',
  sourceUpdatedAt: null, averageRating: 4.25, logCount: 2,
};

const trip: TripLog = {
  id: 'trip-1', user: { id: 'user-1', username: 'ana', kind: 'registered', color: null }, rating: 4,
  reviewText: 'Llegó a horario.', liked: true, tags: ['hora pico'], traveledAt: '2026-08-20', createdAt: '2026-08-20T15:00:00.000Z',
  line: { id: line.id, slug: line.slug, name: line.name, shortName: line.shortName, color: line.color, textColor: line.textColor, city: line.city, province: line.province },
};

afterEach(() => vi.restoreAllMocks());

describe('componentes de presentación', () => {
  it('Header adapta navegación y acciones a la sesión', () => {
    const onNavigate = vi.fn();
    const navigation = { mode: '' as const, query: '', onBrowse: vi.fn(), onMembers: vi.fn(), onQueryChange: vi.fn(), onSearchSubmit: vi.fn() };
    const { rerender } = render(<Header {...navigation} view="explore" user={null} onNavigate={onNavigate} onAuth={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '@ana' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrarse' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar bondis, trenes o subtes' }), { target: { value: '60' } });
    expect(navigation.onQueryChange).toHaveBeenCalledWith('60');
    fireEvent.submit(screen.getByRole('search', { name: 'Buscar transportes' }));
    expect(navigation.onSearchSubmit).toHaveBeenCalledOnce();
    rerender(<Header {...navigation} view="diary" user={{ id: 'user-1', username: 'ana', email: 'ana@example.com' }} onNavigate={onNavigate} onAuth={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByText('@ana'));
    fireEvent.click(screen.getByRole('button', { name: 'Mi perfil' }));
    expect(onNavigate).toHaveBeenCalledWith('diary');
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });

  it('LineCard comunica selección, recorrido y promedio', () => {
    const onSelect = vi.fn();
    render(<LineCard line={line} selected onSelect={onSelect} />);
    const card = screen.getByRole('button', { pressed: true });
    expect(screen.getByText('Constitución')).toBeInTheDocument();
    expect(screen.getByText('Tigre')).toBeInTheDocument();
    expect(screen.getByLabelText('De Constitución a Tigre')).toBeInTheDocument();
    expect(screen.getByLabelText('Promedio 4.25 de 5')).toBeInTheDocument();
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(line);
  });

  it('LineCard contiene nombres largos de tren y usa el color institucional como fallback', () => {
    const train: TransportLine = {
      ...line,
      id: 'tren-regional',
      slug: 'rosario-canada-de-gomez',
      name: 'Rosario – Cañada de Gómez',
      shortName: 'Rosario – Cañada de Gómez',
      mode: 'tren',
      color: '#575b5c',
    };

    render(<LineCard line={train} selected={false} onSelect={vi.fn()} />);
    const trainMark = screen.getByTitle(train.shortName);
    expect(trainMark).toHaveClass('is-train', 'is-long');
    expect(trainMark.style.getPropertyValue('--line-color')).toBe('#0077c8');
    expect(lineCardColors({ ...train, shortName: 'Mitre', name: 'Línea Mitre' }).color).toBe('#178f59');
  });

  it('TripEntry muestra autor, reseña, fecha semántica y rating', () => {
    render(<TripEntry trip={trip} />);
    expect(screen.getByText('@ana')).toBeInTheDocument();
    expect(screen.getByText('dejó una reseña en')).toBeInTheDocument();
    expect(screen.getByText('Llegó a horario.')).toBeInTheDocument();
    expect(screen.getByLabelText('4 de 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Le gustó')).toBeInTheDocument();
    expect(screen.getByText('hora pico')).toBeInTheDocument();
    const traveledAt = screen.getByRole('time');
    expect(traveledAt).toHaveAttribute('datetime', '2026-08-20');
    expect(traveledAt.closest('small')).toHaveTextContent('AMBA, 20 de agosto de 2026');
  });

  it('TripEntry oculta el identificador anónimo y distribuye colores estables por reseña', () => {
    const anonymousTrip: TripLog = { ...trip, user: { id: 'anon-identity-42', username: 'Anon vr7182gcq', kind: 'anonymous', color: '#3aa6ff' } };
    const { rerender } = render(<TripEntry trip={anonymousTrip} />);
    const badge = screen.getByLabelText('Autor anónimo');
    expect(screen.queryByText('Anon vr7182gcq')).not.toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Autor anónimo');
    expect(badge).toHaveClass(`is-${anonymousVariant('anon-identity-42')}`);
    expect(badge.style.getPropertyValue('--anon-color')).toBe(anonymousColor('trip-1'));
    expect(badge.closest('.trip-author-mark')).toBeInTheDocument();
    expect(anonymousVariant('anon-identity-42')).toBe(anonymousVariant('anon-identity-42'));

    rerender(<TripEntry trip={{ ...anonymousTrip, id: 'trip-2' }} />);
    expect(screen.getByLabelText('Autor anónimo').style.getPropertyValue('--anon-color')).toBe(anonymousColor('trip-2'));
    expect(anonymousColor('trip-2')).not.toBe(anonymousColor('trip-1'));
  });

  it('Modal cierra con Escape, backdrop y botón accesible', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal title="Prueba" onClose={onClose}><p>Contenido</p></Modal>);
    expect(screen.getByRole('dialog', { name: 'Prueba' })).toBeInTheDocument();
    expect(document.body).toHaveClass('modal-open');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('presentation'));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<></>);
    expect(document.body).not.toHaveClass('modal-open');
  });

  it('RatingInput expone cinco opciones accesibles y comunica la selección', () => {
    const onChange = vi.fn();
    render(<RatingInput value={2} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radios[4]!);
    expect(onChange).toHaveBeenCalledWith(5);
  });
});

describe('diálogos', () => {
  it('AuthDialog alterna a registro y entrega el usuario autenticado', async () => {
    const user = { id: 'user-1', username: 'ana', email: null };
    vi.spyOn(api, 'register').mockResolvedValue({ user });
    const onAuthenticated = vi.fn();
    render(<AuthDialog onClose={vi.fn()} onAuthenticated={onAuthenticated} />);
    fireEvent.click(screen.getByRole('button', { name: 'No tengo cuenta, registrarme' }));
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña-segura' } });
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('minlength', '10');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(user));
    expect(api.register).toHaveBeenCalledWith({ username: 'ana', password: 'contraseña-segura' });
  });

  it('AuthDialog expone el error devuelto por la API', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Credenciales inválidas'));
    render(<AuthDialog onClose={vi.fn()} onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
  });

  it('AuthDialog contextual empieza por ingreso y explica qué se guardará', () => {
    render(<AuthDialog intent="save-trip" onClose={vi.fn()} onAuthenticated={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByText('Guardalo en tu perfil.')).toBeInTheDocument();
    expect(screen.getByText(/guardar todo en tu perfil/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No tengo cuenta, registrarme' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No tengo cuenta, registrarme' }));
    expect(screen.getByText(/guardar tus reseñas, puntajes, likes y seguir randoms/)).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
  });

  it('AuthDialog permite continuar con una identidad Anon estable', async () => {
    const onContinueAnonymous = vi.fn().mockResolvedValue(undefined);
    render(<AuthDialog intent="save-trip" onClose={vi.fn()} onAuthenticated={vi.fn()} onContinueAnonymous={onContinueAnonymous} />);
    expect(screen.getByText('Vas a ser un anon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publicar sin registrarse/ }));
    await waitFor(() => expect(onContinueAnonymous).toHaveBeenCalledOnce());
  });

  it('LogTripDialog busca desde dos caracteres y entrega reseña, like y tags', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const laPlataLine: TransportLine = { ...line, id: 'line-275', slug: 'linea-275', name: 'Línea 275', shortName: '275', city: 'Provincia de Buenos Aires', origin: 'La Plata', destination: 'Ensenada' };
    render(<LogTripDialog lines={[line, laPlataLine]} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Servicio' }), { target: { value: '6' } });
    expect(screen.queryByText(/Escribí un carácter más/)).not.toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    const serviceInput = screen.getByRole('combobox', { name: 'Servicio' });
    fireEvent.change(serviceInput, { target: { value: 'ensenada,' } });
    expect(screen.getByRole('option', { name: /Línea 275/ })).toBeInTheDocument();
    fireEvent.change(serviceInput, { target: { value: 'la plat,a' } });
    expect(screen.getByRole('option', { name: /Línea 275/ })).toBeInTheDocument();
    fireEvent.change(serviceInput, { target: { value: '60' } });
    fireEvent.click(screen.getByRole('option', { name: /Línea 60/ }));
    fireEvent.focus(serviceInput);
    expect(serviceInput).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/No encontramos servicios/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fecha del viaje')).toHaveValue(localDateValue());
    fireEvent.click(screen.getByRole('radio', { name: '4 de 5' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Me gustó' }));
    fireEvent.change(screen.getByRole('textbox', { name: /^Reseña/ }), { target: { value: 'Buen viaje' } });
    expect(screen.getByLabelText(/Tags/)).toHaveAttribute('placeholder', '#limpio #hechomierda');
    fireEvent.change(screen.getByLabelText(/Tags/), { target: { value: '#lluvia #hora_pico' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar reseña' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ lineId: line.id, rating: 4, reviewText: 'Buen viaje', liked: true, tags: ['lluvia', 'hora_pico'] })));
  });

  it('calcula la fecha del navegador y no la fecha UTC', () => {
    const localLateNight = new Date('2026-08-21T02:30:00.000Z');
    localLateNight.getTimezoneOffset = () => 180;
    expect(localDateValue(localLateNight)).toBe('2026-08-20');
  });
});
