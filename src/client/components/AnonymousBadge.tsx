function identityScore(value: string): number {
  let score = 2166136261;
  for (const character of value) {
    score ^= character.charCodeAt(0);
    score = Math.imul(score, 16777619);
  }
  return score >>> 0;
}

const ANONYMOUS_COLORS = ['#ff7a1a', '#00c778', '#3aa6ff', '#ef476f', '#f2c14e', '#8f7cff', '#23b5a5', '#e4572e'] as const;

export function anonymousColor(seed: string): string {
  return ANONYMOUS_COLORS[identityScore(seed) % ANONYMOUS_COLORS.length]!;
}

export function anonymousVariant(id: string): 'solid' | 'multicolor' | 'special' {
  const percentile = identityScore(id) % 100;
  if (percentile < 2) return 'special';
  if (percentile < 10) return 'multicolor';
  return 'solid';
}

export function AnonymousBadge({ id, visualSeed = id }: { id: string; visualSeed?: string }) {
  const variant = anonymousVariant(id);
  return (
    <strong
      className={`anonymous-author is-${variant}`}
      style={{ '--anon-color': anonymousColor(visualSeed) } as React.CSSProperties}
      aria-label="Autor anónimo"
    >Anon</strong>
  );
}
