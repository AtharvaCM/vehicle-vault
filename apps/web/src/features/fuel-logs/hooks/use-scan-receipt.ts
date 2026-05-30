import { useMutation } from '@tanstack/react-query';
import type { ExtractionResult, FuelReceiptExtractionDraft } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type ScannedFuelLog = FuelReceiptExtractionDraft;

export async function scanReceipt(file: File): Promise<ScannedFuelLog> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<
    ApiSuccessResponse<ExtractionResult<FuelReceiptExtractionDraft>>,
    FormData
  >(endpoints.fuelLogs.scan(), formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: (file: File) => scanReceipt(file),
  });
}

export function useScanStatus() {
  return {
    queryKey: ['fuel-logs', 'scan-status'],
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessResponse<{ available: boolean }>>(
        endpoints.fuelLogs.scanStatus(),
      );
      return response.data;
    },
  };
}
