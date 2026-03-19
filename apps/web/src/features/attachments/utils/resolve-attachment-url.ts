import { apiClient } from '@/lib/api/api-client';

export function resolveAttachmentUrl(url: string) {
  return apiClient.buildUrl(url).toString();
}
