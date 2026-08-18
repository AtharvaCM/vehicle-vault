import { useMutation } from '@tanstack/react-query';
import type {
  ExtractionResult,
  VehicleDocumentExtractionDraft,
  VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

type ScanInput = {
  vehicleId: string;
  kind: VehicleDocumentKind;
  file: File;
};

/** One result type for every document kind — the draft carries whichever fields the kind uses. */
export type VehicleDocumentScanResult = ExtractionResult<VehicleDocumentExtractionDraft>;

async function scanVehicleDocument(input: ScanInput): Promise<VehicleDocumentScanResult> {
  const formData = new FormData();
  formData.append('file', input.file);

  const response = await apiClient.post<
    ApiSuccessResponse<VehicleDocumentScanResult>,
    FormData
  >(endpoints.vehicleDocuments.scan(input.vehicleId), formData, {
    query: { kind: input.kind },
    // Do NOT set Content-Type — fetch must auto-generate the multipart boundary.
    // apiClient already skips Content-Type for FormData bodies.
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
