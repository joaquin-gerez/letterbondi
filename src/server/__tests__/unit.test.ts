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
  it('normaliza email y usuario válidos', () => {
    const parsed = registerSchema.parse({ username: ' pasajero_1 ', email: 'VIAJE@EXAMPLE.COM', password: '12345678' });
    expect(parsed).toMatchObject({ username: 'pasajero_1', email: 'viaje@example.com' });
    expect(loginSchema.parse({ email: 'VIAJE@EXAMPLE.COM', password: 'x' }).email).toBe('viaje@example.com');
  });

  it('rechaza identificadores, ratings y fechas fuera de contrato', () => {
    const user = registerSchema.safeParse({ username: 'con espacio', email: 'mal', password: 'corta' });
    expect(user.success).toBe(false);
    if (!user.success) expect(validationMessage(user.error)).toBeTruthy();
    expect(tripSchema.safeParse({ lineId: '', rating: 0, traveledAt: 'hoy' }).success).toBe(false);
    expect(tripSchema.safeParse({ lineId: 'line-60', rating: 5, reviewText: 'Bien', traveledAt: '2026-08-20' }).success).toBe(true);
  });
});

describe('dataset inicial', () => {
  it('mantiene identificadores únicos y fuentes públicas trazables', () => {
    expect(new Set(INITIAL_LINES.map((line) => line.id)).size).toBe(INITIAL_LINES.length);
    expect(new Set(INITIAL_LINES.map((line) => line.slug)).size).toBe(INITIAL_LINES.length);
    for (const line of INITIAL_LINES) {
      expect(line.sourceName).not.toBe('');
      expect(line.sourceUrl).toMatch(/^https:\/\//);
      expect(line.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('declara honestamente una base federal inicial, no cobertura nacional ficticia', () => {
    expect(new Set(INITIAL_LINES.map((line) => line.province)).size).toBe(4);
    expect(new Set(INITIAL_LINES.map((line) => line.mode))).toEqual(new Set(['colectivo', 'tren', 'trolebus']));
  });
});
