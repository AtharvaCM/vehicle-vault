import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/format-date';

import type { Attachment } from '../types/attachment';
import { formatFileSize } from '../utils/format-file-size';
import { getAttachmentKindLabel } from '../utils/get-attachment-kind-label';
import { resolveAttachmentUrl } from '../utils/resolve-attachment-url';

type AttachmentItemProps = {
  attachment: Attachment;
  isDeleting?: boolean;
  onDelete: (attachmentId: string) => Promise<void> | void;
};

export function AttachmentItem({ attachment, isDeleting = false, onDelete }: AttachmentItemProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-950">{attachment.originalFileName}</p>
          <Badge>{getAttachmentKindLabel(attachment.kind)}</Badge>
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

      <div className="flex gap-2">
        <a
          className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50"
          href={resolveAttachmentUrl(attachment.url)}
          rel="noreferrer"
          target="_blank"
        >
          Open
        </a>
        <ConfirmActionDialog
          confirmLabel="Delete attachment"
          description={`This removes ${attachment.originalFileName} from the maintenance record and deletes the local uploaded file when available.`}
          isPending={isDeleting}
          onConfirm={() => onDelete(attachment.id)}
          title="Delete this attachment?"
          triggerLabel="Delete"
          triggerVariant="secondary"
        />
      </div>
    </div>
  );
}
