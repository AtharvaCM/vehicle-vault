import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import {
  createWarranty,
  deleteWarranty,
  listWarranties,
  updateWarranty,
} from '../api/warranty';
import { type CreateWarrantyInput, type UpdateWarrantyInput } from '@vehicle-vault/shared';

export function useWarranties(vehicleId: string) {
  return useQuery({
    queryKey: queryKeys.warranty.byVehicle(vehicleId),
    queryFn: () => listWarranties(vehicleId),
  });
}

export function useCreateWarranty(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWarrantyInput) => createWarranty(vehicleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.warranty.byVehicle(vehicleId),
      });
    },
  });
}

export function useUpdateWarranty(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWarrantyInput }) =>
      updateWarranty(vehicleId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.warranty.byVehicle(vehicleId),
      });
    },
  });
}

export function useDeleteWarranty(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWarranty(vehicleId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.warranty.byVehicle(vehicleId),
      });
    },
  });
}
