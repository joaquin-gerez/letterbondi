import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { CreateTripInput, TransportLine } from '../../shared/types';
import { Modal } from './Modal';
import { RatingInput } from './RatingInput';

const MAX_RESULTS = 24;

export function localDateValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function serviceLabel(line: TransportLine): string {
  return `${line.name} · ${line.city}, ${line.province}`;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim();
}

function ServiceSearch({ lines, initialLineId, onSelect }: { lines: TransportLine[]; initialLineId?: string; onSelect: (line: TransportLine | null) => void }) {
  const initialLine = lines.find((line) => line.id === initialLineId) ?? null;
  const [query, setQuery] = useState(initialLine ? serviceLabel(initialLine) : '');
  const [selectedId, setSelectedId] = useState(initialLine?.id ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const term = normalizeSearch(query);
  const matches = useMemo(() => {
    if (term.length < 2) return [];
    const terms = term.split(/\s+/);
    return lines.filter((line) => {
      const searchable = normalizeSearch([line.shortName, line.name, line.city, line.province, line.operator ?? '', line.origin ?? '', line.destination ?? ''].join(' '));
      return terms.every((part) => searchable.includes(part));
    }).slice(0, MAX_RESULTS);
  }, [lines, term]);

  function choose(line: TransportLine) {
    setSelectedId(line.id);
    setQuery(serviceLabel(line));
    setOpen(false);
    setActiveIndex(-1);
    onSelect(line);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !matches.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(matches[activeIndex]!);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="service-search">
      <label htmlFor="service-query">Servicio</label>
      <input name="lineId" type="hidden" value={selectedId} />
      <input
        id="service-query"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="service-results"
        aria-expanded={!selectedId && open && term.length >= 2}
        aria-activedescendant={activeIndex >= 0 ? `service-result-${activeIndex}` : undefined}
        autoComplete="off"
        value={query}
        placeholder="Buscar servicio"
        onFocus={() => setOpen(!selectedId && term.length >= 2)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={keyDown}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setSelectedId('');
          setOpen(normalizeSearch(value).length >= 2);
          setActiveIndex(-1);
          onSelect(null);
        }}
      />
      {!selectedId && open && term.length >= 2 && (
        <div className="service-results" id="service-results" role="listbox">
          {matches.length ? matches.map((line, index) => (
            <button
              id={`service-result-${index}`}
              className={activeIndex === index ? 'is-active' : ''}
              key={line.id}
              type="button"
              role="option"
              aria-selected={selectedId === line.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(line)}
            >
              <span className="service-result-number" style={{ '--line-color': line.color, '--line-ink': line.textColor } as React.CSSProperties}>{line.shortName}</span>
              <span><strong>{line.name}</strong><small>{line.city}, {line.province}</small></span>
            </button>
          )) : <p>No encontramos servicios con “{query.trim()}”.</p>}
        </div>
      )}
    </div>
  );
}

export function LogTripDialog({ lines, initialLineId, onClose, onSubmit }: { lines: TransportLine[]; initialLineId?: string; onClose: () => void; onSubmit: (input: CreateTripInput) => Promise<void> }) {
  const initialLine = lines.find((line) => line.id === initialLineId) ?? null;
  const [selectedLine, setSelectedLine] = useState<TransportLine | null>(initialLine);
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = localDateValue();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const lineId = String(data.get('lineId') ?? '');
    if (!lineId) { setError('Elegí un servicio de la lista'); return; }
    const rawTags = String(data.get('tags') ?? '').trim();
    const parsedTags = rawTags.includes('#')
      ? (rawTags.match(/#[^\s#]+/g) ?? []).map((tag) => tag.slice(1))
      : rawTags.split(',');
    const tags = Array.from(new Set(parsedTags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 5);
    const input: CreateTripInput = {
      lineId,
      rating,
      traveledAt: String(data.get('traveledAt')),
      reviewText: String(data.get('reviewText') ?? ''),
      liked: data.get('liked') === 'on',
      tags,
    };
    setBusy(true);
    try { await onSubmit(input); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos registrar el viaje'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={selectedLine ? `Reseñar ${selectedLine.name}` : 'Reseñar un viaje'} onClose={onClose}>
      <form className="stack-form review-form" onSubmit={submit}>
        <ServiceSearch lines={lines} initialLineId={initialLineId} onSelect={setSelectedLine} />
        {selectedLine && <label className="trip-date">Viajé el día <input aria-label="Fecha del viaje" name="traveledAt" type="date" defaultValue={today} max={today} required /></label>}
        <div className="review-reactions">
          <RatingInput value={rating} onChange={setRating} />
          <label className="like-toggle"><input name="liked" type="checkbox" /><span aria-hidden="true">♥</span><strong>Me gustó</strong></label>
        </div>
        <label><span className="field-label"><strong>Reseña</strong><small>(opcional)</small></span><textarea name="reviewText" maxLength={2000} rows={5} placeholder="¿Cómo fue el viaje?" /></label>
        <label><span className="field-label"><strong>Tags</strong><small>(opcional)</small></span><input name="tags" maxLength={160} placeholder="#limpio #hechomierda" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action full" disabled={busy}>{busy ? 'Guardando…' : 'Publicar reseña'}</button>
      </form>
    </Modal>
  );
}
