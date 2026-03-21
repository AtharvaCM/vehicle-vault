import type {
  PasswordResetConfirmInput,
  PasswordResetConfirmResponse,
} from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function resetPassword(input: PasswordResetConfirmInput) {
  const response = await apiClient.post<
    ApiSuccessResponse<PasswordResetConfirmResponse>,
    PasswordResetConfirmInput
  >(endpoints.auth.passwordResetConfirm, input, {
    skipAuthRefresh: true,
    skipUnauthorizedHandler: true,
  });

  return response.data;
}
