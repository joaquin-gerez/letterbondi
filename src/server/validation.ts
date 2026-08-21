import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, 'Usá sólo letras, números y guion bajo'),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const tripSchema = z.object({
  lineId: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(2000).optional(),
  traveledAt: z.iso.date(),
});

export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos';
}
