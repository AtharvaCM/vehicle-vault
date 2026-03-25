import { useMutation } from '@tanstack/react-query';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export interface ScannedFuelLog {
  date?: string;
  quantity?: number;
  price?: number;
  totalCost?: number;
  location?: string;
}

export async function scanReceipt(file: File): Promise<ScannedFuelLog> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiSuccessResponse<ScannedFuelLog>, FormData>(
    endpoints.fuelLogs.scan(),
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
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
        endpoints.fuelLogs.scanStatus()
      );
      return response.data;
    },
  };
}
