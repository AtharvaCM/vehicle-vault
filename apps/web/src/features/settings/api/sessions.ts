import { queryOptions } from '@tanstack/react-query';
import type { AuthSession } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function getSessions() {
  const response = await apiClient.get<ApiSuccessResponse<AuthSession[]>>(endpoints.auth.sessions);
  return response.data;
}

export function sessionsQueryOptions() {
  return queryOptions({
    queryKey: ['account', 'sessions'] as const,
    queryFn: getSessions,
  });
}

/** Signs one device out; it lands on sign-in at its next refresh. */
export async function revokeSession(sessionId: string) {
  await apiClient.delete<ApiSuccessResponse<{ revoked: boolean }>>(
    endpoints.auth.session(sessionId),
  );
}

/** Signs out every device but this one. */
export async function revokeOtherSessions() {
  const response = await apiClient.delete<ApiSuccessResponse<{ revoked: number }>>(
    endpoints.auth.otherSessions,
  );
  return response.data;
}
