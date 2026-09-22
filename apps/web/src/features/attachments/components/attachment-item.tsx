import { Wand2 } from 'lucide-react';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { openApiFileInNewTab } from '@/lib/api/open-api-file';
import { appToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils/format-date';

import type { Attachment } from '../types/attachment';
import { formatFileSize } from '../utils/format-file-size';
import { getAttachmentKindLabel } from '../utils/get-attachment-kind-label';

type AttachmentItemProps = {
  attachment: Attachment;
  isDeleting?: boolean;
  /** Omitted for a viewer, which drops the delete control. */
  onDelete?: (attachmentId: string) => Promise<void> | void;
  /** Omitted wherever filling the record in is not offered, which drops the control. */
  onFillFromPhoto?: (attachment: Attachment) => void;
};

/** What the extractor reads: a photo or a PDF. */
function canFillFrom(attachment: Attachment) {
  return attachment.mimeType.startsWith('image/') || attachment.mimeType === 'application/pdf';
}

export function AttachmentItem({
  attachment,
  isDeleting = false,
  onDelete,
  onFillFromPhoto,
}: AttachmentItemProps) {
  const handleOpen = async () => {
    try {
      await openApiFileInNewTab(endpoints.attachments.file(attachment.id));
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not open attachment') });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 @xl:flex-row @xl:items-center @xl:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-950">{attachment.originalFileName}</p>
          <Badge>{getAttachmentKindLabel(attachment.kind)}</Badge>
          {attachment.extraction ? (
            <Badge
              tone={
                attachment.extraction.status === 'failed'
                  ? 'danger'
                  : attachment.extraction.status === 'pending'
                    ? 'warning'
                    : 'accent'
              }
            >
              {attachment.extraction.status === 'completed'
                ? 'OCR ready'
                : attachment.extraction.status === 'failed'
                  ? 'OCR failed'
                  : 'OCR pending'}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-1 text-sm text-slate-600">
          <p>
            {attachment.mimeType} • {formatFileSize(attachment.size)}
          </p>
          <p>
            Uploaded{' '}
            {formatDate(attachment.uploadedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50"
          onClick={handleOpen}
          type="button"
        >
          View file
        </button>
        {onFillFromPhoto && canFillFrom(attachment) ? (
          <Button
            onClick={() => onFillFromPhoto(attachment)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Wand2 />
            {attachment.mimeType === 'application/pdf' ? 'Fill in from PDF' : 'Fill in from photo'}
          </Button>
        ) : null}
        {onDelete ? (
          <ConfirmActionDialog
            confirmLabel="Delete attachment"
            description={`This removes ${attachment.originalFileName} from this service entry. If available, the stored file is deleted too.`}
            isPending={isDeleting}
            onConfirm={() => onDelete(attachment.id)}
            title="Delete this attachment?"
            triggerLabel="Delete"
            triggerVariant="secondary"
          />
        ) : null}
      </div>
    </div>
  );
}
