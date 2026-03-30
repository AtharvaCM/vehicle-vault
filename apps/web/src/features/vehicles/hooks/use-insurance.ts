import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import {
  createInsurancePolicy,
  deleteInsurancePolicy,
  listInsurancePolicies,
  updateInsurancePolicy,
} from '../api/insurance';
import { type CreateInsurancePolicyInput, type UpdateInsurancePolicyInput } from '@vehicle-vault/shared';

export function useInsurancePolicies(vehicleId: string) {
  return useQuery({
    queryKey: queryKeys.insurance.byVehicle(vehicleId),
    queryFn: () => listInsurancePolicies(vehicleId),
  });
}

export function useCreateInsurancePolicy(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInsurancePolicyInput) => createInsurancePolicy(vehicleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.insurance.byVehicle(vehicleId),
      });
    },
  });
}

export function useUpdateInsurancePolicy(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInsurancePolicyInput }) =>
      updateInsurancePolicy(vehicleId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.insurance.byVehicle(vehicleId),
      });
    },
  });
}

export function useDeleteInsurancePolicy(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteInsurancePolicy(vehicleId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.insurance.byVehicle(vehicleId),
      });
    },
  });
}
