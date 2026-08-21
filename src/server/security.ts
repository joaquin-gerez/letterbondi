import { isIP } from 'node:net';

function normalizeIp(ip: string): string {
  return (ip.startsWith('::ffff:') ? ip.slice(7) : ip).toLowerCase();
}

export function isPrivateAddress(address: string): boolean {
  const ip = normalizeIp(address).toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168);
  }
  return isIP(ip) === 6 && (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || /^fe[89ab]/.test(ip));
}

export function trustedProxyAddress(): string | undefined {
  const configured = process.env.TRUST_PROXY_IP?.trim();
  if (!configured) return undefined;
  if (!isPrivateAddress(configured)) throw new Error('TRUST_PROXY_IP debe ser una dirección IP privada');
  return normalizeIp(configured);
}

export function sameAddress(left: string, right: string): boolean {
  return normalizeIp(left) === normalizeIp(right);
}

export function clientAddress(remoteAddress: string | undefined, forwardedFor: string | string[] | undefined, trustedProxy?: string): string {
  const remote = normalizeIp(remoteAddress ?? 'unknown');
  if (!trustedProxy || !sameAddress(remote, trustedProxy) || typeof forwardedFor !== 'string') return remote;
  const candidate = forwardedFor.split(',').at(-1)?.trim() ?? '';
  return isIP(candidate) ? normalizeIp(candidate) : remote;
}

export function originAllowed(origin: string | undefined, host: string | undefined, protocol: string, publicOrigin?: string): boolean {
  if (!origin) return true;
  try {
    const expected = publicOrigin ? new URL(publicOrigin).origin : new URL(`${protocol}://${host}`).origin;
    return origin !== 'null' && new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

export function createRateLimiter(limit: number, windowMs: number) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  return (key: string): number => {
    const now = Date.now();
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      if (!entry && entries.size >= 10_000) {
        for (const [storedKey, stored] of entries) if (stored.resetAt <= now) entries.delete(storedKey);
        if (entries.size >= 10_000) return Math.ceil(windowMs / 1000);
      }
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
    return entry.count > limit ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : 0;
  };
}
