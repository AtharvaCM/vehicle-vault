import { useQuery } from '@tanstack/react-query';

import { loanScheduleQueryOptions } from '../api/get-schedule';

export function useLoanSchedule(loanId: string) {
  return useQuery(loanScheduleQueryOptions(loanId));
}
