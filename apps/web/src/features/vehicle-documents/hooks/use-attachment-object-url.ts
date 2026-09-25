import { queryOptions, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

/** An attached file's bytes, fetched once and kept for the session. */
export function attachmentBlobQueryOptions(attachmentId: string) {
  return queryOptions({
    queryKey: ['attachments', 'blob', attachmentId],
    queryFn: () => apiClient.getBlob(endpoints.attachments.file(attachmentId)),
    staleTime: Infinity,
  });
}

/**
 * A blob as something an <img> or a new tab can show.
 *
 * The URL is made in the effect that releases it, not memoised beside it: under
 * StrictMode an effect runs, is cleaned up and runs again, and a memoised URL
 * would be revoked by the first cleanup and then shown dead.
 */
export function useObjectUrl(blob: Blob | null | undefined) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return objectUrl;
}

/**
 * An attached file as something an <img> can show. File endpoints sit behind
 * the bearer-token guard, so a plain src cannot reach them: the file is fetched
 * through the API client and given an object URL.
 */
export function useAttachmentObjectUrl(attachmentId: string | null) {
  const blobQuery = useQuery({
    ...attachmentBlobQueryOptions(attachmentId ?? ''),
    enabled: attachmentId !== null,
  });
  const objectUrl = useObjectUrl(blobQuery.data);

  return {
    objectUrl,
    isPending: blobQuery.isPending && attachmentId !== null,
    isError: blobQuery.isError,
  };
}
