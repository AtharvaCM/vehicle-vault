import type { VerifyEmailInput, VerifyEmailResponse } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function verifyEmail(input: VerifyEmailInput) {
  const response = await apiClient.post<ApiSuccessResponse<VerifyEmailResponse>, VerifyEmailInput>(
    endpoints.auth.verifyEmail,
    input,
    // A spent or unknown link answers 401. That is about the link, not the
    // session: it must never refresh, sign out or redirect a signed-in user.
    {
      skipAuthRefresh: true,
      skipUnauthorizedHandler: true,
    },
  );

  return response.data;
}
