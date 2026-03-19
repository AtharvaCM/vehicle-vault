import type { z } from 'zod';

import {
  AuthResponseSchema,
  AuthUserSchema,
  LoginSchema,
  RegisterSchema,
  UserSchema,
} from '../schemas';

export type User = z.infer<typeof UserSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
