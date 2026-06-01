import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateLoanPrepaymentInput, LoanForecloseInput } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import { addPrepayment, deletePrepayment, forecloseLoan } from '../api/loan-actions';

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleLoans.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
}

export function useAddPrepayment(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLoanPrepaymentInput) => addPrepayment(loanId, input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeletePrepayment(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prepaymentId: string) => deletePrepayment(loanId, prepaymentId),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useForecloseLoan(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoanForecloseInput) => forecloseLoan(loanId, input),
    onSuccess: () => invalidate(queryClient),
  });
}
