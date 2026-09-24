import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateTyreInput,
  CreateTyreInspectionInput,
  UpdateTyreInput,
} from '@vehicle-vault/shared';

import { invalidateAudit } from '@/lib/query/invalidate-audit';
import { queryKeys } from '@/lib/query/query-keys';

import { createTyre, createTyreInspection } from '../api/create-tyre';
import {
  vehicleTyreConditionQueryOptions,
  vehicleTyreInspectionsQueryOptions,
  vehicleTyresQueryOptions,
} from '../api/get-tyres';
import { deleteTyre, updateTyre } from '../api/manage-tyre';

/**
 * Every tyre write leaves the whole tyre subtree stale — list, grading and
 * readings share its prefix — and the grading shown afterwards is the one the
 * API returns, never one worked out here. The dashboard's attention queue
 * carries the same verdicts, and every tyre write is audited.
 */
function invalidateTyres(queryClient: QueryClient, vehicleId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tyres.all(vehicleId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
  invalidateAudit(queryClient);
}

export function useVehicleTyres(vehicleId: string) {
  return useQuery(vehicleTyresQueryOptions(vehicleId));
}

export function useVehicleTyreCondition(vehicleId: string) {
  return useQuery(vehicleTyreConditionQueryOptions(vehicleId));
}

export function useVehicleTyreInspections(vehicleId: string) {
  return useQuery(vehicleTyreInspectionsQueryOptions(vehicleId));
}

export function useCreateTyre(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTyreInput) => createTyre(vehicleId, body),
    // Fitting a tyre retires whatever was at that position, so the whole tyre
    // subtree is stale, not just the list.
    onSuccess: () => invalidateTyres(queryClient, vehicleId),
  });
}

export function useUpdateTyre(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tyreId, input }: { tyreId: string; input: UpdateTyreInput }) =>
      updateTyre(tyreId, input),
    onSuccess: () => invalidateTyres(queryClient, vehicleId),
  });
}

export function useDeleteTyre(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tyreId: string) => deleteTyre(tyreId),
    onSuccess: () => invalidateTyres(queryClient, vehicleId),
  });
}

export function useCreateTyreInspection(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTyreInspectionInput) => createTyreInspection(vehicleId, body),
    onSuccess: () => invalidateTyres(queryClient, vehicleId),
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
    onSettled: () => invalidateTyres(queryClient, vehicleId),
  });
}
