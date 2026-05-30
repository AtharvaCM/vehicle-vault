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
});
