import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceBaselineUpsertInput } from '@vehicle-vault/shared';

import { invalidateAudit } from '@/lib/query/invalidate-audit';
import { queryKeys } from '@/lib/query/query-keys';

import {
  serviceBaselineCoverageQueryOptions,
  upsertServiceBaseline,
} from '../api/service-baseline';

export function useServiceBaselineCoverage(vehicleId: string) {
  return useQuery(serviceBaselineCoverageQueryOptions(vehicleId));
}

export function useUpsertServiceBaseline(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ServiceBaselineUpsertInput) => upsertServiceBaseline(vehicleId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.serviceBaseline.coverage(vehicleId),
      });
      // A baseline changes which services are considered due, so anything
      // rendering "next due" from the same figures has to be refetched.
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.detail(vehicleId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
      invalidateAudit(queryClient);
    },
  });
}
