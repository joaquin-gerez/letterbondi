import { useState, type FormEvent } from 'react';
import type { CreateTripInput, TransportLine } from '../../shared/types';
import { Modal } from './Modal';
import { RatingInput } from './RatingInput';

export function localDateValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function LogTripDialog({ lines, initialLineId, onClose, onSubmit }: { lines: TransportLine[]; initialLineId?: string; onClose: () => void; onSubmit: (input: CreateTripInput) => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = localDateValue();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (!rating) { setError('Elegí una calificación'); return; }
    const data = new FormData(event.currentTarget);
    const input: CreateTripInput = { lineId: String(data.get('lineId')), rating, traveledAt: String(data.get('traveledAt')), reviewText: String(data.get('reviewText') ?? '') };
    setBusy(true);
    try { await onSubmit(input); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos registrar el viaje'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Registrar viaje" onClose={onClose}>
      <form className="stack-form" onSubmit={submit}>
        <label>Servicio<select name="lineId" defaultValue={initialLineId ?? lines[0]?.id} required>{lines.map((line) => <option value={line.id} key={line.id}>{line.name} · {line.city}</option>)}</select></label>
        <label>Fecha<input name="traveledAt" type="date" defaultValue={today} max={today} required /></label>
        <RatingInput value={rating} onChange={setRating} />
        <label>Reseña <span>(opcional)</span><textarea name="reviewText" maxLength={2000} rows={5} placeholder="¿Cómo fue el viaje?" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action full" disabled={busy}>{busy ? 'Guardando…' : 'Guardar en mi diario'}</button>
      </form>
    </Modal>
  );
}
