import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getAdminUsers, type AdminUsersQueryParams } from '../api/get-admin-users';

export function useAdminUsers(params: AdminUsersQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.admin.users(params),
    queryFn: () => getAdminUsers(params),
    placeholderData: keepPreviousData,
  });
}
