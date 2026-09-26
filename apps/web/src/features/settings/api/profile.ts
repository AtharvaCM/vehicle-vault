import type { AuthUser, ProfileUpdateInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

/** A new name for the signed-in account; the response is the account as it now reads. */
export async function updateProfile(input: ProfileUpdateInput) {
  const response = await apiClient.patch<ApiSuccessResponse<AuthUser>, ProfileUpdateInput>(
    endpoints.auth.me,
    input,
  );
  return response.data;
}
