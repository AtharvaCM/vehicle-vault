import type { AuthUser } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function getMe() {
  const response = await apiClient.get<ApiSuccessResponse<AuthUser>>(endpoints.auth.me);

  return response.data;
}
