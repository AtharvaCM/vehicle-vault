import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getUpcoming, UPCOMING_LATER_PAGE_SIZE, type UpcomingFilters } from '../api/get-upcoming';

/**
 * The timeline, with the `later` group paged. Every page repeats the near
 * groups (they are never paged), so a reader takes those from the first page
 * and only `later` rows from the rest.
 */
export function useUpcoming(filters: UpcomingFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.dashboard.upcoming(filters),
    queryFn: ({ pageParam }) => getUpcoming(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * UPCOMING_LATER_PAGE_SIZE < lastPage.laterTotal
        ? lastPage.page + 1
        : undefined,
  });
}
