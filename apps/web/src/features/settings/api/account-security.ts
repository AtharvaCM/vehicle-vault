import { queryOptions } from '@tanstack/react-query';
import type { AccountSecurity, AuthResponse, PasswordChangeInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function getAccountSecurity() {
  const response = await apiClient.get<ApiSuccessResponse<AccountSecurity>>(
    endpoints.auth.security,
  );
  return response.data;
}

export function accountSecurityQueryOptions() {
  return queryOptions({
    queryKey: ['account', 'security'] as const,
    queryFn: getAccountSecurity,
  });
}

/** A new password; the response is a fresh session for this device (every other one is signed out). */
export async function changePassword(input: PasswordChangeInput) {
  const response = await apiClient.post<ApiSuccessResponse<AuthResponse>, PasswordChangeInput>(
    endpoints.auth.password,
    input,
  );
  return response.data;
}
