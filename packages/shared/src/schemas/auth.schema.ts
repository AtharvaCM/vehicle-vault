import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(8).max(72),
});

export const UserSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AuthUserSchema = UserSchema.pick({
  id: true,
  name: true,
  email: true,
});

export const AuthResponseSchema = z.object({
  user: AuthUserSchema,
  accessToken: z.string().trim().min(1),
  refreshToken: z.string().trim().min(1),
});

export const PasswordResetRequestResponseSchema = z.object({
  accepted: z.literal(true),
  expiresAt: z.string().datetime().optional(),
  previewToken: z.string().trim().min(1).optional(),
});

export const PasswordResetConfirmResponseSchema = z.object({
  reset: z.literal(true),
});
