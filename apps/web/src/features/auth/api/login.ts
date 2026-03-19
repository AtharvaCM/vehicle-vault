import type { AuthResponse, LoginInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function login(input: LoginInput) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResponse>, LoginInput>(
    endpoints.auth.login,
    input,
  );

  return response.data;
}
