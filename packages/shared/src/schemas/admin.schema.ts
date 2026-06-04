import { z } from 'zod';

import { UserRoleSchema } from './auth.schema';

export const AdminUserSummarySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: UserRoleSchema,
  emailVerified: z.boolean(),
  allowedCatalogSources: z.array(z.string()),
  vehicleCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const AdminUserListResponseSchema = z.object({
  users: z.array(AdminUserSummarySchema),
  meta: z
    .object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      search: z.string().optional(),
    })
    .optional(),
});

export const AdminForceLogoutResponseSchema = z.object({
  userId: z.string().trim().min(1),
  refreshTokenCleared: z.boolean(),
});
