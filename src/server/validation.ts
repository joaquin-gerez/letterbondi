import { z } from 'zod';

const usernameSchema = z.string().trim().min(2, 'Usá al menos 2 caracteres').max(24, 'Usá hasta 24 caracteres')
  .regex(/^[\p{L}\p{N}._-]+$/u, 'Usá letras, números, punto, guion o guion bajo')
  .transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(10, 'Usá al menos 10 caracteres').max(128),
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
  traveledAt: z.iso.date().refine((value) => value <= new Date().toISOString().slice(0, 10), 'La fecha del viaje no puede ser futura'),
});

export function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Datos inválidos';
  const field = issue.path[0] === 'username' ? 'Usuario' : issue.path[0] === 'password' ? 'Contraseña' : null;
  return field ? `${field}: ${issue.message}` : issue.message;
}
