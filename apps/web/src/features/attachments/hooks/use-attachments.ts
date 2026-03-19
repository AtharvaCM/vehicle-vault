import { useQuery } from '@tanstack/react-query';

import { attachmentsQueryOptions } from '../api/get-attachments';

export function useAttachments(recordId: string) {
  return useQuery(attachmentsQueryOptions(recordId));
}
