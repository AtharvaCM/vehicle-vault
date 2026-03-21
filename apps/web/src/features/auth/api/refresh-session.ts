import type { AuthResponse, RefreshTokenInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function refreshSession(input: RefreshTokenInput) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResponse>, RefreshTokenInput>(
    endpoints.auth.refresh,
    input,
    {
      skipAuthRefresh: true,
      skipUnauthorizedHandler: true,
    },
  );

  return response.data;
}
