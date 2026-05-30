import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getAdminUsers } from '../api/get-admin-users';

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: getAdminUsers,
  });
}
