import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Attachment, AttachmentExtraction } from '@/features/attachments/types/attachment';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { openApiFileInNewTab } from '@/lib/api/open-api-file';
import { queryKeys } from '@/lib/query/query-keys';
import { appToast } from '@/lib/toast';

import { hasBillValues } from '../utils/get-fields-from-bill';

type DraftBillSummaryProps = {
  attachments: Attachment[];
  /** The completed read the draft was filled from, if any. */
  extraction?: AttachmentExtraction;
  /** How many of the form's fields still hold what the bill says. */
  fieldsFromBillCount: number;
  /** Whether the server can read bills at all. */
  extractionAvailable?: boolean;
};

/**
 * The top of a draft's confirm page: the bill it came from, and in one line
 * what reading it gave the form — so a form that opens blank says why rather
 * than passing for one that was filled.
 */
export function DraftBillSummary({
  attachments,
  extraction,
  fieldsFromBillCount,
  extractionAvailable,
}: DraftBillSummaryProps) {
  const [bill] = attachments;

  if (!bill) {
    return null;
  }

  const note = getNote({ attachments, extraction, fieldsFromBillCount, extractionAvailable });

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-3"
      data-testid="draft-bill-summary"
    >
      <BillThumbnail attachment={bill} />
      <div className="min-w-0 space-y-1">
        <p className="truncate text-ui font-medium text-fg">
          {bill.originalFileName}
          {attachments.length > 1 ? ` and ${attachments.length - 1} more` : ''}
        </p>
        <p
          className={note.tone === 'warning' ? 'text-ui text-soon' : 'text-ui text-fg-2'}
          role={note.tone === 'warning' ? 'status' : undefined}
        >
          {note.text}
        </p>
      </div>
    </div>
  );
}

function getNote({
  attachments,
  extraction,
  fieldsFromBillCount,
  extractionAvailable,
}: Omit<DraftBillSummaryProps, 'attachments'> & { attachments: Attachment[] }): {
  text: string;
  tone: 'info' | 'warning';
} {
  if (extraction) {
    if (!hasBillValues(extraction)) {
      return {
        text: 'Nothing on the bill could be read into the form. Fill in the details below.',
        tone: 'warning',
      };
    }

    if (fieldsFromBillCount === 0) {
      return {
        text: 'The bill was read, but not filled in. Use Apply to draft in Document review, or fill in the details below.',
        tone: 'warning',
      };
    }

    return {
      text: 'Filled in from the bill. Check each field marked "from bill", then confirm.',
      tone: 'info',
    };
  }

  const failed = attachments.find((attachment) => attachment.extraction?.status === 'failed');

  if (failed) {
    return {
      text: `The bill could not be read${
        failed.extraction?.failureReason ? ` (${failed.extraction.failureReason})` : ''
      }. Fill in the details below, or use Read again in Document review.`,
      tone: 'warning',
    };
  }

  if (extractionAvailable === false) {
    return {
      text: "Reading bills isn't available right now, so nothing was filled in. Fill in the details below.",
      tone: 'warning',
    };
  }

  return {
    text: "The bill hasn't been read yet. Fill in the details below, or use Read again in Document review.",
    tone: 'warning',
  };
}

/** The file endpoint needs the bearer token, so the image is fetched and shown as a blob. */
function BillThumbnail({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType.startsWith('image/');
  const fileQuery = useQuery({
    queryKey: [...queryKeys.attachments.detail(attachment.id), 'file'],
    queryFn: () => apiClient.getBlob(endpoints.attachments.file(attachment.id)),
    enabled: isImage,
    staleTime: Infinity,
  });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileQuery.data) {
      return;
    }

    const url = URL.createObjectURL(fileQuery.data);
    setObjectUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [fileQuery.data]);

  async function handleOpen() {
    try {
      await openApiFileInNewTab(endpoints.attachments.file(attachment.id));
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not open the bill') });
    }
  }

  return (
    <button
      aria-label={`Open ${attachment.originalFileName}`}
      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-page"
      onClick={handleOpen}
      type="button"
    >
      {objectUrl ? (
        <img alt="" className="h-full w-full object-cover" src={objectUrl} />
      ) : (
        <FileText className="h-6 w-6 text-fg-3" />
      )}
    </button>
  );
}
