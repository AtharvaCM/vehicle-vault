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
  return (
    <div className="space-y-3">
      {attachments.map((attachment) => (
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
