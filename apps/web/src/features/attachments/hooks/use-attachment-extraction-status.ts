import { useQuery } from '@tanstack/react-query';

import { attachmentExtractionStatusQueryOptions } from '../api/get-attachment-extraction-status';

export function useAttachmentExtractionStatus() {
  return useQuery(attachmentExtractionStatusQueryOptions());
}
