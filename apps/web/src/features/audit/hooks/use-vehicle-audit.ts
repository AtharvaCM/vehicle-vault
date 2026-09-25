import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getVehicleAudit } from '../api/get-vehicle-audit';

export function useVehicleAudit(vehicleId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.audit.byVehicle(vehicleId),
    // A vehicle's activity is its garage changes only; sign-ins are the account's.
    queryFn: ({ pageParam }) => getVehicleAudit(vehicleId, { category: 'garage' }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
