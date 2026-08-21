import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreateTripInput, PlatformStats, ProfileResponse, SessionUser, TransportLine, TransportMode, TripLog } from '../shared/types';
import { api } from './api';
import { AuthDialog } from './components/AuthDialog';
import { Header } from './components/Header';
import { LineCard } from './components/LineCard';
import { LogTripDialog } from './components/LogTripDialog';
import { TripEntry } from './components/TripEntry';

const MODES: Array<{ value: '' | TransportMode; label: string }> = [
  { value: '', label: 'Todos' }, { value: 'colectivo', label: 'Colectivos' },
  { value: 'tren', label: 'Trenes' }, { value: 'trolebus', label: 'Trolebuses' },
];

export default function App() {
  const [lines, setLines] = useState<TransportLine[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [view, setView] = useState<'explore' | 'diary'>('explore');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'' | TransportMode>('');
  const [province, setProvince] = useState('');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [pendingTrip, setPendingTrip] = useState<CreateTripInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextLines, nextTrips, nextStats, session] = await Promise.all([api.lines(), api.trips(), api.stats(), api.me()]);
      setLines(nextLines); setTrips(nextTrips); setStats(nextStats); setUser(session.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos cargar Letterbondi');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (view !== 'diary' || !user) return;
    api.profile(user.username).then(setProfile).catch((reason) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar tu diario'));
  }, [view, user]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const provinces = useMemo(() => Array.from(new Set(lines.map((line) => line.province))).sort(), [lines]);
  const filteredLines = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return lines.filter((line) => (!mode || line.mode === mode) && (!province || line.province === province) && (!term || [line.name, line.shortName, line.city, line.province, line.operator ?? ''].some((value) => value.toLocaleLowerCase('es').includes(term))));
  }, [lines, mode, province, query]);
  const visibleTrips = selectedLineId ? trips.filter((trip) => trip.line.id === selectedLineId) : trips;
  const selectedLine = lines.find((line) => line.id === selectedLineId) ?? null;

  function requestLog() {
    setLogOpen(true);
  }

  async function logout() {
    try { await api.logout(); setUser(null); setProfile(null); setView('explore'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos cerrar la sesión'); }
  }

  async function tripCreated(trip: TripLog, profileUsername = user?.username) {
    setLogOpen(false); setTrips((current) => [trip, ...current]); setNotice('Viaje guardado en tu diario.');
    const [nextLines, nextStats] = await Promise.all([api.lines(), api.stats()]);
    setLines(nextLines); setStats(nextStats);
    if (profileUsername) setProfile(await api.profile(profileUsername));
  }

  async function submitTrip(input: CreateTripInput) {
    if (!user) {
      setPendingTrip(input);
      setLogOpen(false);
      setAuthOpen(true);
      return;
    }
    await tripCreated(await api.createTrip(input));
  }

  async function authenticated(nextUser: SessionUser) {
    setUser(nextUser);
    setAuthOpen(false);
    if (!pendingTrip) return;
    const tripToSave = pendingTrip;
    setPendingTrip(null);
    try {
      await tripCreated(await api.createTrip(tripToSave), nextUser.username);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ingresaste, pero no pudimos guardar el viaje');
    }
  }

  return (
    <div className="app-shell">
      <Header view={view} user={user} onNavigate={setView} onAuth={() => setAuthOpen(true)} onLogout={() => void logout()} onLogTrip={requestLog} />
      {notice && <div className="notice" role="status">{notice}</div>}
      <main id="main">
        {view === 'explore' ? (
          <>
            <section className="intro" aria-labelledby="page-title">
              <div>
                <p className="eyebrow">Archivo abierto · Argentina</p>
                <h1 id="page-title">Cada viaje deja registro.</h1>
                <p className="intro-copy">Una bitácora pública para recordar, puntuar y contar cómo nos movemos.</p>
              </div>
              <dl className="platform-stats">
                <div><dt>Servicios</dt><dd>{stats?.lineCount ?? '—'}</dd></div>
                <div><dt>Provincias</dt><dd>{stats?.provinceCount ?? '—'}</dd></div>
                <div><dt>Viajes</dt><dd>{stats?.logCount ?? '—'}</dd></div>
              </dl>
            </section>

            {error && <section className="error-panel" role="alert"><strong>No pudimos cargar la aplicación.</strong><span>{error}</span><button onClick={() => void load()}>Reintentar</button></section>}

            <section className="catalog" aria-labelledby="catalog-title">
              <header className="section-heading"><div><p className="index">01</p><h2 id="catalog-title">Servicios</h2></div><p>Cobertura inicial con fuente pública visible en cada ficha.</p></header>
              <div className="filters">
                <label className="search-field"><span className="sr-only">Buscar servicios</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar línea, ciudad u operador" /></label>
                <div className="mode-filter" role="group" aria-label="Filtrar por modo">{MODES.map((item) => <button key={item.label} className={mode === item.value ? 'is-active' : ''} onClick={() => setMode(item.value)}>{item.label}</button>)}</div>
                <label className="province-filter"><span className="sr-only">Provincia</span><select value={province} onChange={(event) => setProvince(event.target.value)}><option value="">Todas las provincias</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              {loading ? <div className="loading-lines" aria-label="Cargando servicios"><i /><i /><i /></div> : filteredLines.length ? (
                <div className="line-list">{filteredLines.map((line) => <LineCard key={line.id} line={line} selected={selectedLineId === line.id} onSelect={(item) => setSelectedLineId(selectedLineId === item.id ? null : item.id)} />)}</div>
              ) : <p className="empty-state">No encontramos servicios con esos filtros.</p>}
              {selectedLine && <div className="source-note"><span>Fuente: <a href={selectedLine.sourceUrl} target="_blank" rel="noreferrer">{selectedLine.sourceName}</a></span><button onClick={requestLog}>Registrar viaje en {selectedLine.name}</button></div>}
            </section>

            <section className="activity" aria-labelledby="activity-title">
              <header className="section-heading"><div><p className="index">02</p><h2 id="activity-title">Actividad reciente</h2></div>{selectedLine && <button className="clear-filter" onClick={() => setSelectedLineId(null)}>Ver todas</button>}</header>
              {visibleTrips.length ? <div className="trip-list">{visibleTrips.map((trip) => <TripEntry trip={trip} key={trip.id} />)}</div> : <div className="empty-state prominent"><p>{selectedLine ? `Todavía nadie registró la ${selectedLine.name}.` : 'El archivo todavía está vacío.'}</p><button className="primary-action" onClick={requestLog}>Registrar el primer viaje</button></div>}
            </section>
          </>
        ) : (
          <section className="diary" aria-labelledby="diary-title">
            <header className="section-heading diary-heading"><div><p className="index">Archivo personal</p><h1 id="diary-title">Diario de @{user?.username}</h1></div><button className="primary-action" onClick={requestLog}>Registrar viaje</button></header>
            {profile?.trips.length ? <div className="trip-list">{profile.trips.map((trip) => <TripEntry trip={trip} key={trip.id} />)}</div> : <p className="empty-state prominent">Todavía no registraste viajes.</p>}
          </section>
        )}
      </main>
      <footer className="site-footer"><span>Letterbondi · beta pública</span><a href="/api/openapi.json">API</a><span>Los datos pueden cambiar. Cada ficha indica su fuente.</span></footer>

      {authOpen && <AuthDialog intent={pendingTrip ? 'save-trip' : 'default'} onClose={() => { setAuthOpen(false); setPendingTrip(null); }} onAuthenticated={(nextUser) => void authenticated(nextUser)} />}
      {logOpen && <LogTripDialog lines={lines} initialLineId={selectedLineId ?? undefined} onClose={() => setLogOpen(false)} onSubmit={submitTrip} />}
    </div>
  );
}
