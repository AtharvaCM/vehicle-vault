import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getMyAudit } from '../api/get-my-audit';
import type { AuditResourceType } from '../types/audit-event';

export function useMyAudit(resourceType?: AuditResourceType) {
  return useInfiniteQuery({
    queryKey: queryKeys.audit.me(resourceType),
    queryFn: ({ pageParam }) => getMyAudit({ resourceType }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
