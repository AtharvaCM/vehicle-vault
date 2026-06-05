import type { AdminForceLogoutResponse } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function forceLogoutUser(userId: string) {
  const response = await apiClient.post<ApiSuccessResponse<AdminForceLogoutResponse>, undefined>(
    endpoints.admin.forceLogout(userId),
  );
  return response.data;
}
