import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CreateTripInput, MemberSummary, PlatformStats, ProfileResponse, SessionUser, TransportLine, TransportMode, TripLog } from '../shared/types';
import { api, ApiError } from './api';
import { AuthDialog } from './components/AuthDialog';
import { Header } from './components/Header';
import { HomeHero } from './components/HomeHero';
import { LineCard } from './components/LineCard';
import { LineDetailsDialog } from './components/LineDetailsDialog';
import { LogTripDialog } from './components/LogTripDialog';
import { MembersView } from './components/MembersView';
import { Pagination } from './components/Pagination';
import { TripEntry } from './components/TripEntry';
import { subscribeToTrips } from './realtime';

const MODES: Array<{ value: '' | TransportMode; label: string }> = [
  { value: '', label: 'Todos' }, { value: 'colectivo', label: 'Colectivos' },
  { value: 'tren', label: 'Trenes' }, { value: 'subte', label: 'Subtes' },
];
const PAGE_SIZE = 15;
type CatalogSort = 'popular' | 'rating' | 'name';

function prependTrip(current: TripLog[], trip: TripLog) {
  return current.some((item) => item.id === trip.id) ? current : [trip, ...current].slice(0, 100);
}

function profileFromPath() {
  const match = window.location.pathname.match(/^\/profile\/([^/]+)\/?$/);
  if (!match?.[1]) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return null; }
}

type View = 'explore' | 'diary' | 'members' | 'not-found';

function viewFromPath(): View {
  if (/^\/$/.test(window.location.pathname)) return 'explore';
  if (/^\/members\/?$/.test(window.location.pathname)) return 'members';
  return profileFromPath() ? 'diary' : 'not-found';
}

export default function App() {
  const [lines, setLines] = useState<TransportLine[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<TripLog[] | null>(null);
  const [selectedTripsError, setSelectedTripsError] = useState<string | null>(null);
  const [selectedTripsRetry, setSelectedTripsRetry] = useState(0);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetry, setProfileRetry] = useState(0);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(() => profileFromPath());
  const [view, setView] = useState<View>(() => viewFromPath());
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'' | TransportMode>('');
  const [province, setProvince] = useState('');
  const [sort, setSort] = useState<CatalogSort>('popular');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [detailsLine, setDetailsLine] = useState<TransportLine | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [pendingTrip, setPendingTrip] = useState<CreateTripInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [page, setPage] = useState(1);
  const selectedLineIdRef = useRef(selectedLineId);
  selectedLineIdRef.current = selectedLineId;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextLines, nextTrips, nextStats, session] = await Promise.all([api.lines(), api.trips(), api.stats(), api.me()]);
      setLines(nextLines); setTrips(nextTrips); setStats(nextStats); setUser(session.user); setAnonymousId(session.anonymousId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos cargar Letterbondi');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => subscribeToTrips((trip) => {
    setTrips((current) => prependTrip(current, trip));
    if (selectedLineIdRef.current === trip.line.id) setSelectedTrips((current) => prependTrip(current ?? [], trip));
  }), []);

  useEffect(() => {
    if (!selectedLineId) { setSelectedTrips(null); return; }
    let cancelled = false;
    setSelectedTrips(null);
    setSelectedTripsError(null);
    api.trips(selectedLineId).then((nextTrips) => { if (!cancelled) setSelectedTrips(nextTrips); })
      .catch((reason) => {
        if (!cancelled) {
          setSelectedTrips([]);
          setSelectedTripsError(reason instanceof Error ? reason.message : 'No pudimos cargar las reseñas');
        }
      });
    return () => { cancelled = true; };
  }, [selectedLineId, selectedTripsRetry]);

  useEffect(() => {
    if (view !== 'diary' || !profileUsername) return;
    let cancelled = false;
    setProfile(null);
    setProfileError(null);
    api.profile(profileUsername).then((nextProfile) => { if (!cancelled) setProfile(nextProfile); }).catch((reason) => {
      if (cancelled) return;
      if (reason instanceof ApiError && reason.status === 404) { setView('not-found'); return; }
      setProfileError(reason instanceof Error ? reason.message : 'No pudimos cargar el perfil');
    });
    return () => { cancelled = true; };
  }, [profileUsername, profileRetry, user?.id, view]);

  useEffect(() => {
    if (view !== 'members') return;
    setMembersLoading(true);
    api.members().then(setMembers).catch((reason) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar los miembros')).finally(() => setMembersLoading(false));
  }, [view]);

  useEffect(() => {
    function syncPath() {
      const username = profileFromPath();
      setProfileUsername(username);
      setView(viewFromPath());
    }
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2300);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const publicLines = useMemo(() => lines.filter((line) => line.mode !== 'trolebus'), [lines]);
  const publicStats = useMemo(() => stats ? { ...stats, lineCount: publicLines.length } : null, [publicLines.length, stats]);
  const provinces = useMemo(() => Array.from(new Set(publicLines.map((line) => line.province))).sort(), [publicLines]);
  const filteredLines = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return publicLines
      .filter((line) => (!mode || line.mode === mode) && (!province || line.province === province) && (!term || [line.name, line.shortName, line.city, line.province, line.operator ?? '', line.origin ?? '', line.destination ?? ''].some((value) => value.toLocaleLowerCase('es').includes(term))))
      .sort((left, right) => sort === 'rating'
        ? (right.averageRating ?? 0) - (left.averageRating ?? 0) || right.logCount - left.logCount
        : sort === 'name'
          ? left.shortName.localeCompare(right.shortName, 'es', { numeric: true })
          : right.logCount - left.logCount || (right.averageRating ?? 0) - (left.averageRating ?? 0) || left.name.localeCompare(right.name, 'es', { numeric: true }));
  }, [publicLines, mode, province, query, sort]);
  const totalPages = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const displayedLines = filteredLines.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleTrips = selectedLineId ? selectedTrips : trips;
  const selectedLine = publicLines.find((line) => line.id === selectedLineId) ?? null;
  const hasCatalogFilters = Boolean(query || mode || province || selectedLineId);
  const viewingOwnProfile = Boolean(user && profileUsername === user.username);

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
    if (view !== 'explore') navigate('explore');
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

  function selectLine(line: TransportLine) {
    setSelectedLineId(line.id);
    setDetailsLine(line);
  }

  function browse(nextMode: 'colectivo' | 'tren' | 'subte') {
    navigate('explore'); changeMode(nextMode);
    showCatalog();
  }

  function showMembers() {
    setProfileUsername(null);
    setView('members');
    if (window.location.pathname !== '/members') window.history.pushState({}, '', '/members');
  }

  async function logout() {
    try { await api.logout(); setUser(null); setProfile(null); navigate('explore'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos cerrar la sesión'); }
  }

  async function deleteAccount() {
    if (!window.confirm('¿Eliminar tu cuenta y todas tus reseñas? Esta acción no se puede deshacer.')) return;
    try {
      await api.deleteAccount();
      setUser(null); setProfile(null); navigate('explore');
      setNotice('Tu cuenta y tus reseñas fueron eliminadas.');
      void load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos eliminar tu cuenta'); }
  }

  async function deleteTrip(trip: TripLog) {
    if (!window.confirm('¿Eliminar esta reseña?')) return;
    try {
      await api.deleteTrip(trip.id);
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      setSelectedTrips((current) => current?.filter((item) => item.id !== trip.id) ?? null);
      setProfile((current) => current ? { ...current, trips: current.trips.filter((item) => item.id !== trip.id) } : current);
      setNotice('Reseña eliminada.');
      void Promise.all([api.lines(), api.stats()]).then(([nextLines, nextStats]) => {
        setLines(nextLines); setStats(nextStats);
      }).catch(() => undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos eliminar la reseña'); }
  }

  function navigate(nextView: 'explore' | 'diary') {
    if (nextView === 'diary') {
      if (!user) return;
      setProfileUsername(user.username);
      setView('diary');
      const path = `/profile/${encodeURIComponent(user.username)}`;
      if (window.location.pathname !== path) window.history.pushState({}, '', path);
      return;
    }
    setProfileUsername(null);
    setView('explore');
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
  }

  function openProfile(username: string) {
    setProfileUsername(username);
    setView('diary');
    const path = `/profile/${encodeURIComponent(username)}`;
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
  }

  async function toggleFollow() {
    if (!user || !profile || viewingOwnProfile) return;
    const nextFollowing = !profile.isFollowing;
    setFollowBusy(true);
    try {
      if (nextFollowing) await api.follow(profile.user.username);
      else await api.unfollow(profile.user.username);
      setProfile((current) => current ? {
        ...current,
        isFollowing: nextFollowing,
        followerCount: Math.max(0, current.followerCount + (nextFollowing ? 1 : -1)),
      } : current);
      setNotice(nextFollowing ? `Ahora seguís a @${profile.user.username}.` : `Dejaste de seguir a @${profile.user.username}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos actualizar el seguimiento');
    } finally { setFollowBusy(false); }
  }

  function tripCreated(trip: TripLog, profileUsername = user?.username) {
    setLogOpen(false);
    setTrips((current) => prependTrip(current, trip));
    if (trip.user.kind === 'anonymous') setAnonymousId(trip.user.id);
    if (selectedLineId === trip.line.id) setSelectedTrips((current) => prependTrip(current ?? [], trip));
    setNotice(trip.user.kind === 'anonymous' ? 'Reseña publicada como Anon.' : 'Reseña guardada en tu perfil.');
    void Promise.all([api.lines(), api.stats()]).then(([nextLines, nextStats]) => {
      setLines(nextLines); setStats(nextStats);
    }).catch(() => undefined);
    if (profileUsername) void api.profile(profileUsername).then(setProfile).catch(() => undefined);
  }

  async function submitTrip(input: CreateTripInput) {
    if (!user) {
      setPendingTrip(input);
      setLogOpen(false);
      setAuthOpen(true);
      return;
    }
    tripCreated(await api.createTrip(input));
  }

  async function authenticated(nextUser: SessionUser) {
    setUser(nextUser);
    setAuthOpen(false);
    if (!pendingTrip) return;
    const tripToSave = pendingTrip;
    try {
      tripCreated(await api.createTrip(tripToSave), nextUser.username);
      setPendingTrip(null);
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
    tripCreated(trip, undefined);
  }

  return (
    <div className="app-shell">
      <Header view={view} user={user} mode={mode} query={query} onNavigate={navigate} onAuth={() => setAuthOpen(true)} onLogout={() => void logout()} onBrowse={browse} onMembers={showMembers} onQueryChange={searchFromHeader} onSearchSubmit={showCatalog} />
      {notice && <div className="notice" role="status"><img src="/favicon.svg" alt="" />{notice}</div>}
      <main id="main" className={view === 'explore' ? 'home-main' : 'inner-main'}>
        {view === 'explore' ? (
          <>
            <HomeHero stats={publicStats} onLogTrip={requestLog} />

            {error && <section className="error-panel" role="alert"><strong>No pudimos cargar la aplicación.</strong><span>{error}</span><button onClick={() => void load()}>Reintentar</button></section>}

            <section className="catalog" aria-labelledby="catalog-title">
              <header className="section-heading"><div><h2 id="catalog-title">Buscá tu transporte público</h2></div><label className="catalog-sort">Ordenar<select aria-label="Ordenar servicios" value={sort} onChange={(event) => { setSort(event.target.value as CatalogSort); setPage(1); }}><option value="popular">Más reseñados</option><option value="rating">Mejor puntuados</option><option value="name">Número o nombre</option></select></label></header>
              <div className="filters">
                <div className="search-field">
                  <label><span className="sr-only">Buscar servicios</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedLineId(null); setPage(1); }} placeholder="Buscar línea, ciudad u operador" /></label>
                  {query ? <button type="button" className="reset-search" onClick={clearQuery} aria-label="Limpiar búsqueda" title="Limpiar búsqueda">×</button> : null}
                </div>
                <div className="mode-filter" role="group" aria-label="Filtrar por modo">{MODES.map((item) => <button key={item.label} className={mode === item.value ? 'is-active' : ''} onClick={() => changeMode(item.value)}>{item.label}</button>)}</div>
                <label className="province-filter"><span className="sr-only">Provincia</span><select value={province} onChange={(event) => { setProvince(event.target.value); setSelectedLineId(null); setPage(1); }}><option value="">Todas las provincias</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
                <button type="button" className="reset-filters" onClick={resetCatalog} disabled={!hasCatalogFilters}>Borrar filtros</button>
              </div>
              {loading ? <div className="loading-lines" aria-label="Cargando servicios">{Array.from({ length: PAGE_SIZE }, (_, index) => <i key={index} />)}</div> : filteredLines.length ? (
                <div className="line-list">{displayedLines.map((line) => <LineCard key={line.id} line={line} selected={selectedLineId === line.id} onSelect={selectLine} />)}</div>
              ) : <p className="empty-state">No encontramos servicios con esos filtros.</p>}
              <Pagination currentPage={currentPage} totalPages={totalPages} onChange={changePage} />
            </section>

            <section className="activity" aria-labelledby="activity-title">
              <header className="section-heading activity-heading">
                <div><h2 id="activity-title">Actividad reciente</h2></div>
                {selectedLine ? <div className="activity-filter-status" role="status"><span>Estás viendo las reseñas de <strong>{selectedLine.name}</strong></span><button className="clear-filter" onClick={() => setSelectedLineId(null)}>Ver todas las reseñas</button></div> : null}
              </header>
              {selectedTripsError ? <div className="error-panel" role="alert"><strong>No pudimos cargar las reseñas.</strong><span>{selectedTripsError}</span><button onClick={() => setSelectedTripsRetry((value) => value + 1)}>Reintentar</button></div> : visibleTrips === null ? <p className="empty-state">Cargando reseñas…</p> : visibleTrips.length ? <div className="trip-list">{visibleTrips.map((trip) => <TripEntry trip={trip} key={trip.id} onDelete={user?.id === trip.user.id || anonymousId === trip.user.id ? deleteTrip : undefined} />)}</div> : <div className="empty-state prominent"><p>{selectedLine ? `Todavía nadie reseñó la ${selectedLine.name}.` : 'Todavía no hay reseñas.'}</p><button className="primary-action" onClick={requestLog}>Reseñar el primer viaje</button></div>}
            </section>
          </>
        ) : view === 'members' ? (
          <MembersView members={members} loading={membersLoading} onOpenProfile={openProfile} />
        ) : view === 'diary' ? (
          <section className="diary" aria-labelledby="diary-title">
            <header className="section-heading diary-heading">
              <div className="profile-heading-copy">
                <h1 id="diary-title">Diario de @{profile?.user.username ?? profileUsername}</h1>
                {profile ? <div className="profile-stats"><span><strong>{profile.trips.length}</strong> reseñas</span><span><strong>{profile.followerCount}</strong> seguidores</span><span><strong>{profile.followingCount}</strong> siguiendo</span></div> : null}
              </div>
              {viewingOwnProfile ? <div className="profile-actions"><button className="primary-action" onClick={requestLog}>Reseñar un viaje</button><button className="delete-account" onClick={() => void deleteAccount()}>Eliminar cuenta</button></div> : user && profile ? <button className="follow-action" onClick={() => void toggleFollow()} disabled={followBusy}>{profile.isFollowing ? 'Siguiendo' : 'Seguir'}</button> : null}
            </header>
            {profileError ? <div className="error-panel" role="alert"><strong>No pudimos cargar el perfil.</strong><span>{profileError}</span><button onClick={() => setProfileRetry((value) => value + 1)}>Reintentar</button></div> : !profile ? <p className="empty-state">Cargando perfil…</p> : profile.trips.length ? <div className="trip-list">{profile.trips.map((trip) => <TripEntry trip={trip} key={trip.id} onDelete={user?.id === trip.user.id ? deleteTrip : undefined} />)}</div> : <p className="empty-state prominent">{viewingOwnProfile ? 'Todavía no registraste viajes.' : 'Este perfil todavía no tiene viajes.'}</p>}
          </section>
        ) : (
          <section className="not-found" aria-labelledby="not-found-title">
            <span>404</span>
            <h1 id="not-found-title">Este recorrido no existe.</h1>
            <p>La página pudo haberse movido o el perfil que buscás no está disponible.</p>
            <button className="primary-action" onClick={() => navigate('explore')}>Volver al inicio</button>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-copy">Letterbondi: porque cada viaje en colectivo merece su propia reseña.</span>
        <div className="footer-links">
          <a href="/privacidad.html">Privacidad</a>
          <a className="github-link" href="https://github.com/joaquin-gerez/letterbondi" target="_blank" rel="noreferrer" aria-label="Letterbondi en GitHub" title="Ver código en GitHub">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.88c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.57 9.57 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.3 2.75-1.03 2.75-1.03.55 1.37.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>
          </a>
        </div>
      </footer>

      {authOpen && <AuthDialog intent={pendingTrip ? 'save-trip' : 'default'} onClose={() => setAuthOpen(false)} onAuthenticated={(nextUser) => void authenticated(nextUser)} onContinueAnonymous={pendingTrip ? continueAnonymously : undefined} />}
      {detailsLine && <LineDetailsDialog line={detailsLine} onClose={() => setDetailsLine(null)} onReview={() => { setDetailsLine(null); setLogOpen(true); }} />}
      {logOpen && <LogTripDialog lines={publicLines} initialLineId={selectedLineId ?? undefined} onClose={() => setLogOpen(false)} onSubmit={submitTrip} />}
    </div>
  );
}
