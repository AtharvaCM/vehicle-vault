import type { VerifyEmailInput, VerifyEmailResponse } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function verifyEmail(input: VerifyEmailInput) {
  const response = await apiClient.post<
    ApiSuccessResponse<VerifyEmailResponse>,
    VerifyEmailInput
  >(endpoints.auth.verifyEmail, input);

  return response.data;
}
