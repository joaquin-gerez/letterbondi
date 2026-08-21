import type { TransportLine } from '../../shared/types';

interface LineCardProps {
  line: TransportLine;
  selected: boolean;
  onSelect: (line: TransportLine) => void;
}

export function LineCard({ line, selected, onSelect }: LineCardProps) {
  const route = [line.origin, line.destination].filter(Boolean).join(' — ') || `${line.city}, ${line.province}`;
  return (
    <button className={`line-card ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(line)} aria-pressed={selected}>
      <span className="line-card-number" style={{ '--line-color': line.color, '--line-ink': line.textColor } as React.CSSProperties}>{line.shortName}</span>
      <span className="line-card-copy">
        <strong>{line.name}</strong>
        <span>{route}</span>
        <small>{line.city} · {line.mode}</small>
      </span>
      <span className="line-card-score" aria-label={line.averageRating ? `Promedio ${line.averageRating} de 5` : 'Sin calificaciones'}>
        <strong>{line.averageRating?.toFixed(1) ?? '—'}</strong>
        <small>{line.logCount === 1 ? '1 viaje' : `${line.logCount} viajes`}</small>
      </span>
    </button>
  );
}
