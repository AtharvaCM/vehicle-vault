import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTyreInput, CreateTyreInspectionInput } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import { createTyre, createTyreInspection } from '../api/create-tyre';
import {
  vehicleTyreConditionQueryOptions,
  vehicleTyresQueryOptions,
} from '../api/get-tyres';

export function useVehicleTyres(vehicleId: string) {
  return useQuery(vehicleTyresQueryOptions(vehicleId));
}

export function useVehicleTyreCondition(vehicleId: string) {
  return useQuery(vehicleTyreConditionQueryOptions(vehicleId));
}

export function useCreateTyre(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTyreInput) => createTyre(vehicleId, body),
    // Fitting a tyre retires whatever was at that position, so the whole tyre
    // subtree is stale, not just the list.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.tyres.all(vehicleId) }),
  });
}

export function useCreateTyreInspection(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTyreInspectionInput) => createTyreInspection(vehicleId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.tyres.all(vehicleId) }),
  });
}

export interface TyreInspectionBatchResult {
  saved: number;
  failed: number;
}

/**
 * A walk-around produces one reading per tyre, but the API takes one at a time.
 *
 * Uses allSettled rather than all: if the third of four readings fails, the two
 * that already saved are real and the cache must reflect them. Reporting "saved"
 * when some rows were lost would be worse than the partial write itself.
 */
export function useCreateTyreInspections(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation<TyreInspectionBatchResult, Error, CreateTyreInspectionInput[]>({
    mutationFn: async (bodies) => {
      const results = await Promise.allSettled(
        bodies.map((body) => createTyreInspection(vehicleId, body)),
      );

      return {
        saved: results.filter((result) => result.status === 'fulfilled').length,
        failed: results.filter((result) => result.status === 'rejected').length,
      };
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.tyres.all(vehicleId) }),
  });
}
