import { useQuery } from '@tanstack/react-query';

import { loanQueryOptions, loansQueryOptions, vehicleLoansQueryOptions } from '../api/get-loans';

export function useLoans() {
  return useQuery(loansQueryOptions());
}

export function useVehicleLoans(vehicleId: string) {
  return useQuery(vehicleLoansQueryOptions(vehicleId));
}

export function useLoan(loanId: string) {
  return useQuery(loanQueryOptions(loanId));
}
