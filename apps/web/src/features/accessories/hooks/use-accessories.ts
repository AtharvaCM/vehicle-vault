import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CreateAccessoryInput, UpdateAccessoryInput } from '@vehicle-vault/shared';

import { invalidateAudit } from '@/lib/query/invalidate-audit';
import { queryKeys } from '@/lib/query/query-keys';

import {
  createAccessory,
  deleteAccessory,
  updateAccessory,
  vehicleAccessoriesQueryOptions,
} from '../api/accessories';

/**
 * Accessory spend is its own series in the cost split, the trend chart and the
 * TCO card, so every write invalidates analytics too — queries are stale after
 * 60s with no refetch on focus, and a chart that quietly excludes the row the
 * user just added reads as a bug.
 */
function invalidateAccessories(queryClient: QueryClient, vehicleId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.accessories.all(vehicleId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
  invalidateAudit(queryClient);
}

export function useVehicleAccessories(vehicleId: string) {
  return useQuery(vehicleAccessoriesQueryOptions(vehicleId));
}

export function useCreateAccessory(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAccessoryInput) => createAccessory(vehicleId, body),
    onSuccess: () => invalidateAccessories(queryClient, vehicleId),
  });
}

export function useUpdateAccessory(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccessoryInput }) =>
      updateAccessory(id, input),
    onSuccess: () => invalidateAccessories(queryClient, vehicleId),
  });
}

export function useDeleteAccessory(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accessoryId: string) => deleteAccessory(accessoryId),
    onSuccess: () => invalidateAccessories(queryClient, vehicleId),
  });
}
