import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getHistory, type HistoryFilters } from '../api/get-history';

export function useHistory(
  filters: HistoryFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.history.list(filters),
    queryFn: ({ pageParam }) => getHistory(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Refetched on every visit: a record can be logged from the vehicle page or
    // the quick-log sheet a moment before coming here.
    staleTime: 0,
    enabled,
  });
}
