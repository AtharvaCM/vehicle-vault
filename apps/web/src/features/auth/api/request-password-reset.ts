import type {
  PasswordResetRequestInput,
  PasswordResetRequestResponse,
} from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function requestPasswordReset(input: PasswordResetRequestInput) {
  const response = await apiClient.post<
    ApiSuccessResponse<PasswordResetRequestResponse>,
    PasswordResetRequestInput
  >(endpoints.auth.passwordResetRequest, input, {
    skipAuthRefresh: true,
    skipUnauthorizedHandler: true,
  });

  return response.data;
}
