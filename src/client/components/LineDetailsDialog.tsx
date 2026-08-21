import type { TransportLine } from '../../shared/types';
import { lineCardColors } from './LineCard';
import { Modal } from './Modal';

export function LineDetailsDialog({ line, onClose, onReview }: { line: TransportLine; onClose: () => void; onReview: () => void }) {
  const colors = lineCardColors(line);
  return (
    <Modal title={line.name} onClose={onClose}>
      <div className="line-details">
        <div className="line-details-summary">
          <span className="line-details-number" style={{ '--line-color': colors.color, '--line-ink': colors.textColor } as React.CSSProperties}>{line.shortName}</span>
          <div><strong>{line.averageRating ? `${line.averageRating.toFixed(1)} de 5` : 'Sin puntuación'}</strong><small>{line.logCount === 1 ? '1 viaje registrado' : `${line.logCount} viajes registrados`}</small></div>
        </div>
        <dl>
          <div><dt>Recorrido</dt><dd>{line.origin && line.destination ? `${line.origin} → ${line.destination}` : 'Sin recorrido publicado'}</dd></div>
          <div><dt>Operador</dt><dd>{line.operator ?? 'Sin operador publicado'}</dd></div>
          <div><dt>Ubicación</dt><dd>{line.city}, {line.province}</dd></div>
          <div><dt>Modo</dt><dd>{line.mode}</dd></div>
        </dl>
        <p className="line-details-source">Fuente: <a href={line.sourceUrl} target="_blank" rel="noreferrer">{line.sourceName}</a>{line.sourceUpdatedAt ? ` · actualizada ${line.sourceUpdatedAt}` : ''}</p>
        <button className="primary-action full" onClick={onReview}>Reseñar {line.name}</button>
      </div>
    </Modal>
  );
}
