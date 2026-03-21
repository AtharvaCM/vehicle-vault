import type { z } from 'zod';

import {
  AuthResponseSchema,
  AuthUserSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterSchema,
  UserSchema,
} from '../schemas';

export type User = z.infer<typeof UserSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
