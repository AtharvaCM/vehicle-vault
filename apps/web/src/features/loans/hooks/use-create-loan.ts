import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateVehicleLoanInput } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import { createLoan } from '../api/create-loan';

export function useCreateLoan(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVehicleLoanInput) => createLoan(vehicleId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleLoans.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
    },
  });
}
