import type { RefreshTokenInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

type LogoutResponse = {
  revoked: boolean;
};

export async function logout(input: RefreshTokenInput) {
  const response = await apiClient.post<ApiSuccessResponse<LogoutResponse>, RefreshTokenInput>(
    endpoints.auth.logout,
    input,
    {
      skipAuthRefresh: true,
      skipUnauthorizedHandler: true,
    },
  );

  return response.data;
}
