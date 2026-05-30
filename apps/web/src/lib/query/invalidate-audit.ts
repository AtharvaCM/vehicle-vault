import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from './query-keys';

/**
 * Invalidate every audit query (global `audit.me` feed and per-vehicle
 * `audit.byVehicle` feeds). Call from the `onSuccess` of any mutation that
 * writes an audited resource so the Activity feeds refresh instead of serving
 * stale cache (queryClient defaults: staleTime 60s, refetchOnWindowFocus off).
 *
 * `queryKeys.audit.all()` returns `['audit']`, which prefix-matches both
 * `audit.me(...)` and `audit.byVehicle(...)`.
 */
export function invalidateAudit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.audit.all() });
}
