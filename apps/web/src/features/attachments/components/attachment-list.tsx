import type { Attachment } from '../types/attachment';
import { AttachmentItem } from './attachment-item';

type AttachmentListProps = {
  attachments: Attachment[];
  deletingAttachmentId?: string | null;
  /** Omitted for a viewer, which drops each file's delete control. */
  onDelete?: (attachmentId: string) => Promise<void> | void;
  /** Omitted wherever filling the record in is not offered. */
  onFillFromPhoto?: (attachment: Attachment) => void;
};

export function AttachmentList({
  attachments,
  deletingAttachmentId,
  onDelete,
  onFillFromPhoto,
}: AttachmentListProps) {
  const orderedAttachments = attachments
    .slice()
    .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt));

  return (
    // From xl the list sits in the side column of the record and edit pages, so
    // each file lays out by the list's width rather than the screen's (see
    // "Page width" in CONTEXT.md).
    <div className="space-y-3 @container">
      {orderedAttachments.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          isDeleting={deletingAttachmentId === attachment.id}
          key={attachment.id}
          onDelete={onDelete}
          onFillFromPhoto={onFillFromPhoto}
        />
      ))}
    </div>
  );
}
