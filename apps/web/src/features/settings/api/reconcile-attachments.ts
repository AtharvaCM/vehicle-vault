import type { AttachmentReconciliationSummary } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function reconcileAttachments() {
  return apiClient.post<ApiSuccessResponse<AttachmentReconciliationSummary>, undefined>(
    endpoints.attachments.reconcile,
  );
}
