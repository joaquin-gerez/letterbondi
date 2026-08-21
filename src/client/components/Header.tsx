import type { SessionUser, TransportMode } from '../../shared/types';

interface HeaderProps {
  view: 'explore' | 'diary' | 'members';
  user: SessionUser | null;
  mode: '' | TransportMode;
  query: string;
  onNavigate: (view: 'explore' | 'diary') => void;
  onAuth: () => void;
  onLogout: () => void;
  onBrowse: (mode: 'colectivo' | 'tren' | 'subte') => void;
  onMembers: () => void;
  onQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
}

export function Header({ view, user, mode, query, onNavigate, onAuth, onLogout, onBrowse, onMembers, onQueryChange, onSearchSubmit }: HeaderProps) {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <div className="header-inner">
        <button className="wordmark" onClick={() => onNavigate('explore')} aria-label="Ir al inicio">
          <img className="wordmark-mark" src="/favicon.svg" alt="" width="200" height="120" />
          <span>Letterbondi</span>
        </button>
        <nav className="primary-nav" aria-label="Navegación principal">
          <button className={view === 'explore' && mode === 'colectivo' ? 'is-active' : ''} onClick={() => onBrowse('colectivo')}>Bondis</button>
          <button className={view === 'explore' && mode === 'tren' ? 'is-active' : ''} onClick={() => onBrowse('tren')}>Trenes</button>
          <button className={view === 'explore' && mode === 'subte' ? 'is-active' : ''} onClick={() => onBrowse('subte')}>Subte</button>
          <button className={view === 'members' ? 'is-active' : ''} onClick={onMembers}>Miembros</button>
        </nav>
        <form className="header-search" role="search" aria-label="Buscar transportes" onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}>
          <label><span className="sr-only">Buscar bondis, trenes o subtes</span><input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar" /></label>
        </form>
        <div className="account-nav">
          {user ? (
            <details className="account-menu">
              <summary>@{user.username}</summary>
              <div className="account-popover">
                <button type="button" onClick={() => onNavigate('diary')}>Mi perfil</button>
                <button type="button" onClick={onLogout}>Salir</button>
              </div>
            </details>
          ) : (
            <button className="login-action" onClick={onAuth}>Ingresar</button>
          )}
        </div>
      </div>
    </header>
  );
}
