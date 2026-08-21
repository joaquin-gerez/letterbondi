import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreateTripInput, PlatformStats, ProfileResponse, SessionUser, TransportLine, TransportMode, TripLog } from '../shared/types';
import { api } from './api';
import { AuthDialog } from './components/AuthDialog';
import { Header } from './components/Header';
import { HomeHero } from './components/HomeHero';
import { LineCard } from './components/LineCard';
import { LogTripDialog } from './components/LogTripDialog';
import { Pagination } from './components/Pagination';
import { TripEntry } from './components/TripEntry';
import { subscribeToTrips } from './realtime';

const MODES: Array<{ value: '' | TransportMode; label: string }> = [
  { value: '', label: 'Todos' }, { value: 'colectivo', label: 'Colectivos' },
  { value: 'tren', label: 'Trenes' }, { value: 'subte', label: 'Subtes' },
];
const PAGE_SIZE = 20;

function prependTrip(current: TripLog[], trip: TripLog) {
  return current.some((item) => item.id === trip.id) ? current : [trip, ...current].slice(0, 100);
}

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
  const [page, setPage] = useState(1);

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

  useEffect(() => subscribeToTrips((trip) => setTrips((current) => prependTrip(current, trip))), []);

  useEffect(() => {
    if (view !== 'diary' || !user) return;
    api.profile(user.username).then(setProfile).catch((reason) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar tu diario'));
  }, [view, user]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const publicLines = useMemo(() => lines.filter((line) => line.mode !== 'trolebus'), [lines]);
  const publicStats = useMemo(() => stats ? { ...stats, lineCount: publicLines.length } : null, [publicLines.length, stats]);
  const provinces = useMemo(() => Array.from(new Set(publicLines.map((line) => line.province))).sort(), [publicLines]);
  const filteredLines = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return publicLines
      .filter((line) => (!mode || line.mode === mode) && (!province || line.province === province) && (!term || [line.name, line.shortName, line.city, line.province, line.operator ?? '', line.origin ?? '', line.destination ?? ''].some((value) => value.toLocaleLowerCase('es').includes(term))))
      .sort((left, right) => right.logCount - left.logCount || (right.averageRating ?? 0) - (left.averageRating ?? 0) || left.name.localeCompare(right.name, 'es', { numeric: true }));
  }, [publicLines, mode, province, query]);
  const totalPages = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const displayedLines = filteredLines.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleTrips = selectedLineId ? trips.filter((trip) => trip.line.id === selectedLineId) : trips;
  const selectedLine = publicLines.find((line) => line.id === selectedLineId) ?? null;
  const hasCatalogFilters = Boolean(query || mode || province || selectedLineId);

  function requestLog() {
    setLogOpen(true);
  }

  function showCatalog() {
    window.requestAnimationFrame(() => {
      const target = document.getElementById('catalog-title');
      if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function searchFromHeader(value: string) {
    setQuery(value); setSelectedLineId(null); setPage(1);
    if (view !== 'explore') setView('explore');
    showCatalog();
  }

  function changeMode(nextMode: '' | TransportMode) {
    setMode(nextMode); setSelectedLineId(null); setPage(1);
  }

  function resetCatalog() {
    setQuery(''); setMode(''); setProvince(''); setSelectedLineId(null); setPage(1);
    showCatalog();
  }

  function clearQuery() {
    setQuery(''); setSelectedLineId(null); setPage(1);
  }

  function changePage(nextPage: number) {
    setPage(nextPage); setSelectedLineId(null);
    showCatalog();
  }

  function browse(nextMode: 'colectivo' | 'tren' | 'subte') {
    setView('explore'); changeMode(nextMode);
    showCatalog();
  }

  function showMembers() {
    setView('explore');
    window.requestAnimationFrame(() => document.getElementById('activity-title')?.scrollIntoView({ behavior: 'smooth' }));
  }

  async function logout() {
    try { await api.logout(); setUser(null); setProfile(null); setView('explore'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos cerrar la sesión'); }
  }

  async function tripCreated(trip: TripLog, profileUsername = user?.username) {
    setLogOpen(false);
    setTrips((current) => prependTrip(current, trip));
    setNotice(trip.user.kind === 'anonymous' ? 'Reseña publicada como Anon.' : 'Reseña guardada en tu perfil.');
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

  async function continueAnonymously() {
    if (!pendingTrip) return;
    const tripToSave = pendingTrip;
    const trip = await api.createTrip(tripToSave);
    setPendingTrip(null);
    setAuthOpen(false);
    await tripCreated(trip, undefined);
  }

  return (
    <div className="app-shell">
      <Header view={view} user={user} mode={mode} query={query} onNavigate={setView} onAuth={() => setAuthOpen(true)} onLogout={() => void logout()} onBrowse={browse} onMembers={showMembers} onQueryChange={searchFromHeader} onSearchSubmit={showCatalog} />
      {notice && <div className="notice" role="status"><img src="/favicon.svg" alt="" />{notice}</div>}
      <main id="main" className={view === 'explore' ? 'home-main' : 'inner-main'}>
        {view === 'explore' ? (
          <>
            <HomeHero stats={publicStats} onLogTrip={requestLog} />

            {error && <section className="error-panel" role="alert"><strong>No pudimos cargar la aplicación.</strong><span>{error}</span><button onClick={() => void load()}>Reintentar</button></section>}

            <section className="catalog" aria-labelledby="catalog-title">
              <header className="section-heading"><div><h2 id="catalog-title">Buscá tu transporte público</h2></div><p>Más reseñados primero</p></header>
              <div className="filters">
                <div className="search-field">
                  <label><span className="sr-only">Buscar servicios</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedLineId(null); setPage(1); }} placeholder="Buscar línea, ciudad u operador" /></label>
                  {query ? <button type="button" className="reset-search" onClick={clearQuery} aria-label="Limpiar búsqueda" title="Limpiar búsqueda">×</button> : null}
                </div>
                <div className="mode-filter" role="group" aria-label="Filtrar por modo">{MODES.map((item) => <button key={item.label} className={mode === item.value ? 'is-active' : ''} onClick={() => changeMode(item.value)}>{item.label}</button>)}</div>
                <label className="province-filter"><span className="sr-only">Provincia</span><select value={province} onChange={(event) => { setProvince(event.target.value); setSelectedLineId(null); setPage(1); }}><option value="">Todas las provincias</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
                <button type="button" className="reset-filters" onClick={resetCatalog} disabled={!hasCatalogFilters}>Borrar filtros</button>
              </div>
              {loading ? <div className="loading-lines" aria-label="Cargando servicios"><i /><i /><i /></div> : filteredLines.length ? (
                <div className="line-list">{displayedLines.map((line) => <LineCard key={line.id} line={line} selected={selectedLineId === line.id} onSelect={(item) => setSelectedLineId(selectedLineId === item.id ? null : item.id)} />)}</div>
              ) : <p className="empty-state">No encontramos servicios con esos filtros.</p>}
              <Pagination currentPage={currentPage} totalPages={totalPages} onChange={changePage} />
              {selectedLine && <div className="selected-line-action"><span>{selectedLine.city} · {selectedLine.province}</span><button onClick={requestLog}>Reseñar {selectedLine.name}</button></div>}
            </section>

            <section className="activity" aria-labelledby="activity-title">
              <header className="section-heading"><div><h2 id="activity-title">Actividad reciente</h2></div>{selectedLine && <button className="clear-filter" onClick={() => setSelectedLineId(null)}>Ver todas</button>}</header>
              {visibleTrips.length ? <div className="trip-list">{visibleTrips.map((trip) => <TripEntry trip={trip} key={trip.id} />)}</div> : <div className="empty-state prominent"><p>{selectedLine ? `Todavía nadie reseñó la ${selectedLine.name}.` : 'Todavía no hay reseñas.'}</p><button className="primary-action" onClick={requestLog}>Reseñar el primer viaje</button></div>}
            </section>
          </>
        ) : (
          <section className="diary" aria-labelledby="diary-title">
            <header className="section-heading diary-heading"><div><p className="index">Archivo personal</p><h1 id="diary-title">Diario de @{user?.username}</h1></div><button className="primary-action" onClick={requestLog}>Reseñar un viaje</button></header>
            {profile?.trips.length ? <div className="trip-list">{profile.trips.map((trip) => <TripEntry trip={trip} key={trip.id} />)}</div> : <p className="empty-state prominent">Todavía no registraste viajes.</p>}
          </section>
        )}
      </main>
      <footer className="site-footer">Letterbondi: porque cada viaje en colectivo merece su propia reseña.</footer>

      {authOpen && <AuthDialog intent={pendingTrip ? 'save-trip' : 'default'} onClose={() => { setAuthOpen(false); setPendingTrip(null); }} onAuthenticated={(nextUser) => void authenticated(nextUser)} onContinueAnonymous={pendingTrip ? continueAnonymously : undefined} />}
      {logOpen && <LogTripDialog lines={publicLines} initialLineId={selectedLineId ?? undefined} onClose={() => setLogOpen(false)} onSubmit={submitTrip} />}
    </div>
  );
}
