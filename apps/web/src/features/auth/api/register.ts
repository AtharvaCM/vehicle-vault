import type { AuthResponse, RegisterInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function register(input: RegisterInput) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResponse>, RegisterInput>(
    endpoints.auth.register,
    input,
  );

  return response.data;
}
