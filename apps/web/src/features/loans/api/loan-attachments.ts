import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';
import type { Attachment } from '@/features/attachments/types/attachment';

export async function getLoanAttachments(loanId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Attachment[]>>(
    endpoints.vehicleLoans.attachments(loanId),
  );
  return response.data;
}

export function loanAttachmentsQueryOptions(loanId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicleLoans.attachments(loanId),
    queryFn: () => getLoanAttachments(loanId),
    enabled: Boolean(loanId),
  });
}

export async function uploadLoanAttachments(loanId: string, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await apiClient.post<ApiSuccessResponse<Attachment[]>, FormData>(
    endpoints.vehicleLoans.uploadAttachments(loanId),
    formData,
  );
  return response.data;
}
