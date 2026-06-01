import type {
  CreateLoanPrepaymentInput,
  LoanForecloseInput,
  VehicleLoan,
} from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function addPrepayment(loanId: string, input: CreateLoanPrepaymentInput) {
  const response = await apiClient.post<
    ApiSuccessResponse<VehicleLoan>,
    CreateLoanPrepaymentInput
  >(endpoints.vehicleLoans.addPrepayment(loanId), input);
  return response.data;
}

export async function deletePrepayment(loanId: string, prepaymentId: string) {
  const response = await apiClient.delete<ApiSuccessResponse<VehicleLoan>>(
    endpoints.vehicleLoans.deletePrepayment(loanId, prepaymentId),
  );
  return response.data;
}

export async function forecloseLoan(loanId: string, input: LoanForecloseInput) {
  const response = await apiClient.post<ApiSuccessResponse<VehicleLoan>, LoanForecloseInput>(
    endpoints.vehicleLoans.foreclose(loanId),
    input,
  );
  return response.data;
}
