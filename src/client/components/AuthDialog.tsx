import { useState, type FormEvent } from 'react';
import type { SessionUser } from '../../shared/types';
import { api } from '../api';
import { Modal } from './Modal';

interface AuthDialogProps {
  intent?: 'default' | 'save-trip';
  onClose: () => void;
  onAuthenticated: (user: SessionUser) => void;
}

export function AuthDialog({ intent = 'default', onClose, onAuthenticated }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>(intent === 'save-trip' ? 'register' : 'login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setBusy(true);
    const data = new FormData(event.currentTarget);
    const input = { username: String(data.get('username') ?? ''), email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') };
    try {
      const response = mode === 'register' ? await api.register(input) : await api.login(input);
      onAuthenticated(response.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos iniciar sesión'); }
    finally { setBusy(false); }
  }

  const savingTrip = intent === 'save-trip';

  return (
    <Modal title={savingTrip ? '¿Te lo vas a tomar en serio?' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'} onClose={onClose}>
      {savingTrip && (
        <div className="conversion-copy">
          <strong>Tu viaje ya está listo.</strong>
          <p>{mode === 'register' ? 'Creá una cuenta para guardarlo en tu diario y encontrarlo después.' : 'Ingresá para guardarlo en tu diario.'}</p>
        </div>
      )}
      <form className="stack-form" onSubmit={submit}>
        {mode === 'register' && <label>Usuario<input name="username" autoComplete="username" minLength={3} maxLength={24} required /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : 1} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action full" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
      </form>
      <button className="switch-auth" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
        {mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
      </button>
    </Modal>
  );
}
