import { z } from 'zod';

const usernameSchema = z.string().trim().min(3).max(24)
  .regex(/^[a-zA-Z0-9_]+$/, 'Usá sólo letras, números y guion bajo')
  .transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});

export const tripSchema = z.object({
  lineId: z.string().trim().min(1),
  rating: z.number().int().min(0).max(5),
  reviewText: z.string().trim().max(2000).optional(),
  liked: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(5).optional(),
  traveledAt: z.iso.date(),
});

export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos';
}
