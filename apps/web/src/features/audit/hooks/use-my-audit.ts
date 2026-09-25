import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getMyAudit } from '../api/get-my-audit';
import type { AuditCategory } from '../types/audit-event';

/** The account's activity, one of Settings' two views. */
export function useMyAudit(category: AuditCategory) {
  return useInfiniteQuery({
    queryKey: queryKeys.audit.me(category),
    queryFn: ({ pageParam }) => getMyAudit({ category }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
