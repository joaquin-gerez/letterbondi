import type { TransportLine } from '../../shared/types';

interface LineCardProps {
  line: TransportLine;
  selected: boolean;
  onSelect: (line: TransportLine) => void;
}

const TRAINES_ARGENTINOS_BLUE = '#0077c8';
const GENERIC_TRAIN_COLORS = new Set(['', '#575b5c']);

const OFFICIAL_TRAIN_LINE_COLORS: Record<string, { color: string; textColor: string }> = {
  'belgrano sur': { color: '#f4c900', textColor: '#17212b' },
  mitre: { color: '#178f59', textColor: '#ffffff' },
  roca: { color: '#2684c6', textColor: '#ffffff' },
  sarmiento: { color: '#47a9d6', textColor: '#10212b' },
  'san martin': { color: '#cf3439', textColor: '#ffffff' },
};

function normalizedLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function lineCardColors(line: TransportLine) {
  if (line.mode !== 'tren') return { color: line.color, textColor: line.textColor };

  const label = normalizedLabel(`${line.shortName} ${line.name}`);
  const officialColor = Object.entries(OFFICIAL_TRAIN_LINE_COLORS)
    .find(([lineName]) => label.includes(lineName))?.[1];

  if (officialColor) return officialColor;
  if (GENERIC_TRAIN_COLORS.has(line.color.trim().toLowerCase())) {
    return { color: TRAINES_ARGENTINOS_BLUE, textColor: '#ffffff' };
  }

  return { color: line.color, textColor: line.textColor };
}

export function LineCard({ line, selected, onSelect }: LineCardProps) {
  const route = [line.origin, line.destination].filter(Boolean).join(' — ') || `${line.city}, ${line.province}`;
  const colors = lineCardColors(line);
  const isLongTrainName = line.mode === 'tren' && line.shortName.length > 13;

  return (
    <button className={`line-card ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(line)} aria-pressed={selected}>
      <span
        className={`line-card-number ${line.mode === 'tren' ? 'is-train' : ''} ${isLongTrainName ? 'is-long' : ''}`}
        style={{ '--line-color': colors.color, '--line-ink': colors.textColor } as React.CSSProperties}
        title={line.shortName}
      >
        <span>{line.shortName}</span>
      </span>
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
