import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransportLine, TripLog } from '../../shared/types';
import { api } from '../api';
import { AuthDialog } from '../components/AuthDialog';
import { Header } from '../components/Header';
import { LineCard } from '../components/LineCard';
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
  id: 'trip-1', user: { id: 'user-1', username: 'ana' }, rating: 4,
  reviewText: 'Llegó a horario.', traveledAt: '2026-08-20', createdAt: '2026-08-20T15:00:00.000Z',
  line: { id: line.id, slug: line.slug, name: line.name, shortName: line.shortName, color: line.color, textColor: line.textColor, city: line.city, province: line.province },
};

afterEach(() => vi.restoreAllMocks());

describe('componentes de presentación', () => {
  it('Header adapta navegación y acciones a la sesión', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<Header view="explore" user={null} onNavigate={onNavigate} onAuth={vi.fn()} onLogout={vi.fn()} onLogTrip={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Mi diario' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    rerender(<Header view="diary" user={{ id: 'user-1', username: 'ana', email: 'ana@example.com' }} onNavigate={onNavigate} onAuth={vi.fn()} onLogout={vi.fn()} onLogTrip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mi diario' }));
    expect(onNavigate).toHaveBeenCalledWith('diary');
    expect(screen.getByRole('button', { name: 'Salir de @ana' })).toBeInTheDocument();
  });

  it('LineCard comunica selección, recorrido y promedio', () => {
    const onSelect = vi.fn();
    render(<LineCard line={line} selected onSelect={onSelect} />);
    const card = screen.getByRole('button', { pressed: true });
    expect(card).toHaveTextContent('Constitución — Tigre');
    expect(screen.getByLabelText('Promedio 4.25 de 5')).toBeInTheDocument();
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(line);
  });

  it('TripEntry muestra autor, reseña, fecha semántica y rating', () => {
    render(<TripEntry trip={trip} />);
    expect(screen.getByText('@ana')).toBeInTheDocument();
    expect(screen.getByText('Llegó a horario.')).toBeInTheDocument();
    expect(screen.getByLabelText('4 de 5')).toBeInTheDocument();
    expect(screen.getByRole('time')).toHaveAttribute('datetime', '2026-08-20');
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
    const user = { id: 'user-1', username: 'ana', email: 'ana@example.com' };
    vi.spyOn(api, 'register').mockResolvedValue({ user });
    const onAuthenticated = vi.fn();
    render(<AuthDialog onClose={vi.fn()} onAuthenticated={onAuthenticated} />);
    fireEvent.click(screen.getByRole('button', { name: 'No tengo cuenta' }));
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(user));
    expect(api.register).toHaveBeenCalledWith({ username: 'ana', email: 'ana@example.com', password: 'contraseña-segura' });
  });

  it('AuthDialog expone el error devuelto por la API', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Credenciales inválidas'));
    render(<AuthDialog onClose={vi.fn()} onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
  });

  it('AuthDialog contextual empieza por registro y explica qué se guardará', () => {
    render(<AuthDialog intent="save-trip" onClose={vi.fn()} onAuthenticated={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: '¿Te lo vas a tomar en serio?' })).toBeInTheDocument();
    expect(screen.getByText('Tu viaje ya está listo.')).toBeInTheDocument();
    expect(screen.getByText(/guardarlo en tu diario/)).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
  });

  it('LogTripDialog valida el rating y entrega un borrador sin decidir cómo persistirlo', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LogTripDialog lines={[line]} initialLineId={line.id} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en mi diario' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí una calificación');
    fireEvent.click(screen.getByRole('radio', { name: '4 de 5' }));
    fireEvent.change(screen.getByLabelText(/Reseña/), { target: { value: 'Buen viaje' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en mi diario' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ lineId: line.id, rating: 4, reviewText: 'Buen viaje' })));
  });

  it('calcula la fecha del navegador y no la fecha UTC', () => {
    const localLateNight = new Date('2026-08-21T02:30:00.000Z');
    localLateNight.getTimezoneOffset = () => 180;
    expect(localDateValue(localLateNight)).toBe('2026-08-20');
  });
});
