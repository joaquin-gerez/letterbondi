import { useState } from 'react';
import type { TripLog } from '../../shared/types';
import { AnonymousBadge } from './AnonymousBadge';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function reviewImage(trip: TripLog) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas no disponible');

  context.font = '40px Archivo, sans-serif';
  const words = (trip.reviewText || 'Sin reseña escrita.').split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && context.measureText(nextLine).width > 1000) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }
  lines.push(currentLine);
  const visibleLines = lines.slice(0, 4);
  if (lines.length > 4) visibleLines[3] = `${visibleLines[3]!.replace(/[.…]+$/, '')}…`;

  context.fillStyle = '#12171b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f0bc37';
  context.fillRect(64, 64, 12, 547);
  context.fillRect(104, 127, 1032, 4);
  context.font = '800 38px Archivo, sans-serif';
  context.fillText('LETTERBONDI', 104, 101);
  context.font = '800 58px Archivo, sans-serif';
  context.fillStyle = '#f2f0e9';
  context.fillText(trip.line.name, 104, 205, 1032);
  context.font = '28px Archivo, sans-serif';
  context.fillStyle = '#aeb6ba';
  context.fillText(`${trip.user.kind === 'registered' ? `@${trip.user.username}` : 'Autor anónimo'} · ${formatDate(trip.traveledAt)}`, 104, 251, 1032);
  context.font = '40px Archivo, sans-serif';
  context.fillStyle = '#f2f0e9';
  visibleLines.forEach((line, index) => context.fillText(line, 104, 337 + index * 52, 1032));
  context.font = '32px Archivo, sans-serif';
  context.fillStyle = '#f0bc37';
  context.fillText(trip.rating > 0 ? `${'★'.repeat(trip.rating)}${'☆'.repeat(5 - trip.rating)}  ${trip.rating}/5` : 'Sin puntuación', 104, 581);
  context.font = '22px Archivo, sans-serif';
  context.fillStyle = '#aeb6ba';
  context.textAlign = 'right';
  context.fillText('letterbondi.site', 1136, 581);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen')), 'image/png'));
}

export function TripEntry({ trip, onDelete }: { trip: TripLog; onDelete?: (trip: TripLog) => void }) {
  const activity = trip.reviewText ? 'dejó una reseña en' : trip.liked ? 'marcó que le gustó' : 'puntuó';
  const registered = trip.user.kind === 'registered';
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');

  async function shareReview() {
    setSharing(true);
    setShareError('');
    try {
      const blob = await reviewImage(trip);
      const file = new File([blob], 'letterbondi-resena.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Reseña en Letterbondi' });
      } else {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareError('No pudimos compartir la reseña. Probá de nuevo.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <article className="trip-entry">
      <div className="trip-author-mark">
        {registered
          ? <span className="registered-avatar" aria-hidden="true">{trip.user.username.slice(0, 1).toLocaleUpperCase('es')}</span>
          : <AnonymousBadge id={trip.user.id} visualSeed={trip.id} />}
      </div>
      <div className="trip-body">
        <header className="trip-meta">
          <div className="activity-summary">
            {registered ? <strong>@{trip.user.username}</strong> : <span className="sr-only">Anon </span>}
            <span className="activity-action">{activity}</span>{' '}<strong className="activity-line">{trip.line.name}</strong>
          </div>
          <small className="trip-location-date">{trip.line.city}, <time dateTime={trip.traveledAt}>{formatDate(trip.traveledAt)}</time></small>
        </header>
        <div className="trip-reactions">
          {trip.rating > 0 ? <div className="rating" aria-label={`${trip.rating} de 5`}>{'★'.repeat(trip.rating)}<span>{'★'.repeat(5 - trip.rating)}</span></div> : <span className="no-rating">Sin puntuación</span>}
          {trip.liked && <span className="liked" aria-label="Le gustó">♥</span>}
        </div>
        {trip.reviewText && <p>{trip.reviewText}</p>}
        {trip.tags.length > 0 && <ul className="trip-tags" aria-label="Tags">{trip.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
        <div className="trip-entry-actions">
          <button type="button" className="share-trip" disabled={sharing} onClick={shareReview}>{sharing ? 'Preparando imagen…' : 'Compartir'}</button>
          {onDelete && <button type="button" className="delete-trip" onClick={() => onDelete(trip)}>Eliminar reseña</button>}
          {shareError && <span className="share-trip-error" role="alert">{shareError}</span>}
        </div>
      </div>
    </article>
  );
}
