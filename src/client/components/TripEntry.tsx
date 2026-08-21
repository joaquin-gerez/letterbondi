import type { TripLog } from '../../shared/types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function TripEntry({ trip }: { trip: TripLog }) {
  return (
    <article className="trip-entry">
      <div className="trip-line" style={{ '--line-color': trip.line.color, '--line-ink': trip.line.textColor } as React.CSSProperties}>
        {trip.line.shortName}
      </div>
      <div className="trip-body">
        <header className="trip-meta">
          <div><strong>@{trip.user.username}</strong><span> en {trip.line.name}</span></div>
          <time dateTime={trip.traveledAt}>{formatDate(trip.traveledAt)}</time>
        </header>
        <div className="rating" aria-label={`${trip.rating} de 5`}>{'★'.repeat(trip.rating)}<span>{'★'.repeat(5 - trip.rating)}</span></div>
        {trip.reviewText && <p>{trip.reviewText}</p>}
        <small>{trip.line.city}, {trip.line.province}</small>
      </div>
    </article>
  );
}
