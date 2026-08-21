import catalog from './transportLines.generated.json' with { type: 'json' };
import type { TransportMode } from '../types.js';

export interface SeedLine {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  mode: TransportMode;
  operator: string | null;
  color: string;
  textColor: string;
  origin: string | null;
  destination: string | null;
  city: string;
  province: string;
  sourceName: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
}

export const INITIAL_LINES: SeedLine[] = catalog as SeedLine[];
