import type { SessionUser } from '../../shared/types';

interface HeaderProps {
  view: 'explore' | 'diary';
  user: SessionUser | null;
  onNavigate: (view: 'explore' | 'diary') => void;
  onAuth: () => void;
  onLogout: () => void;
  onLogTrip: () => void;
}

export function Header({ view, user, onNavigate, onAuth, onLogout, onLogTrip }: HeaderProps) {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <div className="header-inner">
        <button className="wordmark" onClick={() => onNavigate('explore')} aria-label="Ir al inicio">
          <span className="wordmark-mark">lb</span>
          <span>letterbondi</span>
          <small>beta</small>
        </button>
        <nav className="primary-nav" aria-label="Navegación principal">
          <button className={view === 'explore' ? 'is-active' : ''} onClick={() => onNavigate('explore')}>Explorar</button>
          {user && <button className={view === 'diary' ? 'is-active' : ''} onClick={() => onNavigate('diary')}>Mi diario</button>}
        </nav>
        <div className="header-actions">
          {user ? (
            <button className="text-action desktop-only" onClick={onLogout}>Salir de @{user.username}</button>
          ) : (
            <button className="text-action" onClick={onAuth}>Ingresar</button>
          )}
          <button className="primary-action" onClick={onLogTrip}>Registrar viaje</button>
        </div>
      </div>
    </header>
  );
}
