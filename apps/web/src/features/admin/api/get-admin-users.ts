import type { AdminUserListResponse } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function getAdminUsers() {
  const response = await apiClient.get<ApiSuccessResponse<AdminUserListResponse>>(
    endpoints.admin.users,
  );

  return response.data;
}
