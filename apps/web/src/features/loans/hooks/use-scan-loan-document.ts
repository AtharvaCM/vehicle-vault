import { useMutation, useQuery } from '@tanstack/react-query';
import type { ExtractionResult, LoanDocumentExtractionDraft } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type ScannedLoanDraft = LoanDocumentExtractionDraft;

export async function scanLoanDocument(file: File): Promise<ScannedLoanDraft> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<
    ApiSuccessResponse<ExtractionResult<LoanDocumentExtractionDraft>>,
    FormData
  >(endpoints.vehicleLoans.scan(), formData);
  return response.data.data;
}

export function useScanLoanDocument() {
  return useMutation({
    mutationFn: (file: File) => scanLoanDocument(file),
  });
}

export function useLoanScanStatus() {
  return useQuery({
    queryKey: ['vehicleLoans', 'scan-status'],
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessResponse<{ available: boolean }>>(
        endpoints.vehicleLoans.scanStatus(),
      );
      return response.data;
    },
    staleTime: 60_000,
  });
}
