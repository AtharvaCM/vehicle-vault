import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getVehicleAudit } from '../api/get-vehicle-audit';

export function useVehicleAudit(vehicleId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.audit.byVehicle(vehicleId),
    queryFn: ({ pageParam }) => getVehicleAudit(vehicleId, {}, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
