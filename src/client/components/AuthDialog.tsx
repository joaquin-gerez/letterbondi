import { useState, type FormEvent } from 'react';
import type { SessionUser } from '../../shared/types';
import { api } from '../api';
import { Modal } from './Modal';

interface AuthDialogProps {
  intent?: 'default' | 'register' | 'save-trip';
  onClose: () => void;
  onAuthenticated: (user: SessionUser) => void;
  onContinueAnonymous?: () => void | Promise<void>;
}

export function AuthDialog({ intent = 'default', onClose, onAuthenticated, onContinueAnonymous }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>(intent === 'register' ? 'register' : 'login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setBusy(true);
    const data = new FormData(event.currentTarget);
    const input = { username: String(data.get('username') ?? ''), password: String(data.get('password') ?? '') };
    try {
      const response = mode === 'register' ? await api.register(input) : await api.login(input);
      onAuthenticated(response.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos iniciar sesión'); }
    finally { setBusy(false); }
  }

  const savingTrip = intent === 'save-trip';

  async function continueAnonymous() {
    if (!onContinueAnonymous) return;
    setError(null); setBusy(true);
    try { await onContinueAnonymous(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos publicar la reseña anónima'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={mode === 'login' ? 'Ingresar' : 'Registrarme'} onClose={onClose}>
      {savingTrip && (
        <div className="conversion-copy">
          <strong>Guardalo en tu perfil.</strong>
          <p>{mode === 'register' ? 'Creá una cuenta para guardar tus reseñas, puntajes, likes y seguir randoms.' : 'Ingresá para guardar todo en tu perfil.'}</p>
        </div>
      )}
      <form className="stack-form" onSubmit={submit}>
        <label>Usuario<input name="username" autoComplete="username" minLength={2} maxLength={24} required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 10 : 1} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action full" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
      </form>
      {savingTrip && onContinueAnonymous && (
        <div className="anonymous-option">
          <span>Sin cuenta</span>
          <button type="button" disabled={busy} onClick={() => void continueAnonymous()}>
            <strong>Publicar sin registrarse</strong>
            <small>Vas a ser un anon</small>
          </button>
        </div>
      )}
      <button className="switch-auth" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
        {mode === 'login' ? 'No tengo cuenta, registrarme' : 'Ya tengo cuenta, ingresar'}
      </button>
    </Modal>
  );
}
