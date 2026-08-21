// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INITIAL_LINES } from '../../shared/data/initialLines.js';
import { hashPassword, hashToken, verifyPassword } from '../auth.js';
import { loginSchema, registerSchema, tripSchema, validationMessage } from '../validation.js';

describe('autenticación', () => {
  it('hashea contraseñas con salt y verifica sin guardar texto plano', async () => {
    const first = await hashPassword('contraseña-segura');
    const second = await hashPassword('contraseña-segura');
    expect(first).not.toBe(second);
    expect(first).not.toContain('contraseña-segura');
    await expect(verifyPassword('contraseña-segura', first)).resolves.toBe(true);
    await expect(verifyPassword('incorrecta', first)).resolves.toBe(false);
    await expect(verifyPassword('cualquiera', 'incompleto')).resolves.toBe(false);
  });

  it('produce hashes de sesión deterministas sin exponer el token', () => {
    const hash = hashToken('token-secreto');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashToken('token-secreto'));
    expect(hash).not.toContain('token-secreto');
  });
});

describe('validación de entrada', () => {
  it('normaliza el usuario y no exige email', () => {
    const parsed = registerSchema.parse({ username: ' PASAJERO_1 ', password: '12345678' });
    expect(parsed).toEqual({ username: 'pasajero_1', password: '12345678' });
    expect(loginSchema.parse({ username: 'PASAJERO_1', password: 'x' }).username).toBe('pasajero_1');
  });

  it('rechaza identificadores, ratings y fechas fuera de contrato', () => {
    const user = registerSchema.safeParse({ username: 'con espacio', password: 'corta' });
    expect(user.success).toBe(false);
    if (!user.success) expect(validationMessage(user.error)).toBeTruthy();
    expect(tripSchema.safeParse({ lineId: '', rating: 0, traveledAt: 'hoy' }).success).toBe(false);
    expect(tripSchema.safeParse({ lineId: 'line-60', rating: 0, reviewText: 'Bien', liked: true, tags: ['lluvia'], traveledAt: '2026-08-20' }).success).toBe(true);
  });
});

describe('dataset inicial', () => {
  it('mantiene identificadores únicos y fuentes públicas trazables', () => {
    expect(INITIAL_LINES.length).toBeGreaterThanOrEqual(983);
    expect(new Set(INITIAL_LINES.map((line) => line.id)).size).toBe(INITIAL_LINES.length);
    expect(new Set(INITIAL_LINES.map((line) => line.slug)).size).toBe(INITIAL_LINES.length);
    for (const line of INITIAL_LINES) {
      expect(line.sourceName).not.toBe('');
      expect(line.sourceUrl).toMatch(/^https:\/\//);
      expect(line.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('incluye el inventario vigente 1–199 sin reintroducir líneas históricas', () => {
    const ambaBuses = INITIAL_LINES.filter((line) => line.id.startsWith('amba-colectivo-'));
    expect(ambaBuses).toHaveLength(133);
    expect(ambaBuses.some((line) => line.shortName === '197')).toBe(true);
    expect(ambaBuses.some((line) => line.shortName === '5')).toBe(false);
    expect(ambaBuses.some((line) => line.shortName === '90')).toBe(false);
  });

  it('conserva colores exactos de la columna B de la planilla pública', () => {
    const color = (shortName: string) => INITIAL_LINES.find((line) => line.id === `amba-colectivo-${shortName}`)?.color;
    expect(color('1')).toBe('#f2f1a1');
    expect(color('2')).toBe('#90050f');
    expect(color('4')).toBe('#d70000');
    expect(color('33')).toBe('#008000');
    expect(color('57')).toBe('#ffffff');
  });

  it('declara una cobertura federal medible y todos los modos del producto', () => {
    expect(new Set(INITIAL_LINES.map((line) => line.province)).size).toBeGreaterThanOrEqual(13);
    expect(new Set(INITIAL_LINES.map((line) => line.mode))).toEqual(new Set(['colectivo', 'tren', 'subte', 'trolebus']));
    expect(INITIAL_LINES.filter((line) => line.id.startsWith('mendoza-colectivo-'))).toHaveLength(377);
    expect(INITIAL_LINES.filter((line) => line.mode === 'tren')).toHaveLength(32);
    expect(INITIAL_LINES.filter((line) => line.mode === 'subte')).toHaveLength(7);
  });
});
