import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import {
  type CreateClaimInput,
  type UpdateClaimInput,
} from '@vehicle-vault/shared';

import {
  createClaim,
  deleteClaim,
  listClaimsForVehicle,
  updateClaim,
} from '../api/claims';

export function useVehicleClaims(vehicleId: string) {
  return useQuery({
    queryKey: queryKeys.claims.byVehicle(vehicleId),
    queryFn: () => listClaimsForVehicle(vehicleId),
  });
}

function invalidateClaims(queryClient: ReturnType<typeof useQueryClient>, vehicleId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.claims.byVehicle(vehicleId) });
  // Maintenance list also surfaces claim status; refresh.
  queryClient.invalidateQueries({ queryKey: ['maintenance'] });
}

export function useCreateClaim(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClaimInput) => createClaim(vehicleId, data),
    onSuccess: () => invalidateClaims(queryClient, vehicleId),
  });
}

export function useUpdateClaim(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClaimInput }) => updateClaim(id, data),
    onSuccess: () => invalidateClaims(queryClient, vehicleId),
  });
}

export function useDeleteClaim(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClaim(id),
    onSuccess: () => invalidateClaims(queryClient, vehicleId),
  });
}
