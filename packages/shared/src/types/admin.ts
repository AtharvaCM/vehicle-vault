import type { z } from 'zod';

import type {
  AdminForceLogoutResponseSchema,
  AdminUserListResponseSchema,
  AdminUserSummarySchema,
} from '../schemas';

export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>;
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;
export type AdminForceLogoutResponse = z.infer<typeof AdminForceLogoutResponseSchema>;
