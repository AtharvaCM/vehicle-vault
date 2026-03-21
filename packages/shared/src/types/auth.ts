import type { z } from 'zod';

import {
  AuthResponseSchema,
  AuthUserSchema,
  LoginSchema,
  PasswordResetConfirmResponseSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestResponseSchema,
  PasswordResetRequestSchema,
  RefreshTokenSchema,
  RegisterSchema,
  UserSchema,
} from '../schemas';

export type User = z.infer<typeof UserSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;
export type PasswordResetRequestResponse = z.infer<typeof PasswordResetRequestResponseSchema>;
export type PasswordResetConfirmResponse = z.infer<typeof PasswordResetConfirmResponseSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
