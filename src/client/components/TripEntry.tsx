import type { TripLog } from '../../shared/types';
import { AnonymousBadge } from './AnonymousBadge';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function TripEntry({ trip }: { trip: TripLog }) {
  const activity = trip.reviewText ? 'dejó una reseña en' : trip.liked ? 'marcó que le gustó' : 'puntuó';
  const registered = trip.user.kind === 'registered';

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
      </div>
    </article>
  );
}
