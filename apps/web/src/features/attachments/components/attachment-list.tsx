import type { Attachment } from '../types/attachment';
import { AttachmentItem } from './attachment-item';

type AttachmentListProps = {
  attachments: Attachment[];
  deletingAttachmentId?: string | null;
  onDelete: (attachmentId: string) => Promise<void> | void;
};

export function AttachmentList({
  attachments,
  deletingAttachmentId,
  onDelete,
}: AttachmentListProps) {
  const orderedAttachments = attachments
    .slice()
    .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt));

  return (
    <div className="space-y-3">
      {orderedAttachments.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          isDeleting={deletingAttachmentId === attachment.id}
          key={attachment.id}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
