import type { AccountExport, AccountExportMeta } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function getAccountExport() {
  return apiClient.get<ApiSuccessResponse<AccountExport, AccountExportMeta>>(endpoints.exports.account);
}
