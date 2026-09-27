import { queryOptions } from '@tanstack/react-query';
import type { AccountDeletionCheck, AccountDeletionInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

/** What deleting the account would take, and any shared vehicle in the way. */
export function accountDeletionCheckQueryOptions() {
  return queryOptions({
    queryKey: ['account', 'deletion'] as const,
    queryFn: async () =>
      (await apiClient.get<ApiSuccessResponse<AccountDeletionCheck>>(endpoints.auth.meDeletion))
        .data,
    // What stands in the way can change in another tab (a vehicle handed over).
    staleTime: 0,
  });
}

/** Deletes the signed-in account at once; its sessions go with it. */
export async function deleteAccount(input: AccountDeletionInput) {
  const response = await apiClient.delete<ApiSuccessResponse<{ deleted: true }>>(
    endpoints.auth.me,
    { body: input },
  );
  return response.data;
}
