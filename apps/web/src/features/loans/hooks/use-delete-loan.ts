import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { deleteLoan } from '../api/delete-loan';

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLoan(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleLoans.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
    },
  });
}
