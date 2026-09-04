import type { VehicleDocumentKind } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type SnoozeDocumentInput = {
  documentKind: VehicleDocumentKind;
  documentId: string;
};

export async function snoozeDocument({ documentKind, documentId }: SnoozeDocumentInput) {
  const response = await apiClient.post<ApiSuccessResponse<{ snoozed: boolean }>, undefined>(
    endpoints.dashboard.snoozeDocument(documentKind, documentId),
  );

  return response.data;
}
