import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { AuditListResponse, AuditQueryFilters } from '../types/audit-event';

export async function getMyAudit(filters: AuditQueryFilters, cursor?: string) {
  const response = await apiClient.get<ApiSuccessResponse<AuditListResponse>>(endpoints.audit.me, {
    query: {
      resourceType: filters.resourceType,
      action: filters.action,
      actionPrefix: filters.actionPrefix,
      from: filters.from,
      to: filters.to,
      limit: filters.limit,
      cursor,
    },
  });

  return response.data;
}
