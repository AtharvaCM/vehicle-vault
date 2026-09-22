import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

/**
 * An attached file as something an <img> can show. File endpoints sit behind
 * the bearer-token guard, so a plain src cannot reach them: the file is fetched
 * through the API client and given an object URL.
 *
 * The URL is made in the effect that releases it, not memoised beside it: under
 * StrictMode an effect runs, is cleaned up and runs again, and a memoised URL
 * would be revoked by the first cleanup and then shown dead.
 */
export function useAttachmentObjectUrl(attachmentId: string | null) {
  const blobQuery = useQuery({
    queryKey: ['attachments', 'blob', attachmentId],
    queryFn: () => apiClient.getBlob(endpoints.attachments.file(attachmentId!)),
    enabled: attachmentId !== null,
    staleTime: Infinity,
  });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blobQuery.data) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blobQuery.data);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blobQuery.data]);

  return {
    objectUrl,
    isPending: blobQuery.isPending && attachmentId !== null,
    isError: blobQuery.isError,
  };
}
