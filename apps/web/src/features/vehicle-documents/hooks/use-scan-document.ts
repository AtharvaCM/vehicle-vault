import { useMutation } from '@tanstack/react-query';
import type {
  ExtractionResult,
  InsurancePolicyExtractionDraft,
  VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

type ScanInput = {
  vehicleId: string;
  kind: VehicleDocumentKind;
  file: File;
};

export type InsurancePolicyScanResult = ExtractionResult<InsurancePolicyExtractionDraft>;

async function scanVehicleDocument(input: ScanInput): Promise<InsurancePolicyScanResult> {
  const formData = new FormData();
  formData.append('file', input.file);

  const response = await apiClient.post<
    ApiSuccessResponse<InsurancePolicyScanResult>,
    FormData
  >(endpoints.vehicleDocuments.scan(input.vehicleId), formData, {
    query: { kind: input.kind },
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export function useScanVehicleDocument() {
  return useMutation({
    mutationFn: scanVehicleDocument,
  });
}

export function useScanStatusQuery(vehicleId: string, kind: VehicleDocumentKind) {
  return {
    queryKey: ['vehicle-documents', 'scan-status', vehicleId, kind] as const,
    queryFn: async () => {
      const response = await apiClient.get<ApiSuccessResponse<{ available: boolean }>>(
        endpoints.vehicleDocuments.scanStatus(vehicleId),
        { query: { kind } },
      );
      return response.data;
    },
  };
}
