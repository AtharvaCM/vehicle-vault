import type { ResendVerificationInput, ResendVerificationResponse } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function resendVerification(input: ResendVerificationInput) {
  const response = await apiClient.post<
    ApiSuccessResponse<ResendVerificationResponse>,
    ResendVerificationInput
  >(endpoints.auth.resendVerification, input);

  return response.data;
}
