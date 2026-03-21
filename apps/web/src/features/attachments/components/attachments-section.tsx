import { useState } from 'react';
import { Paperclip, ReceiptText } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils/format-date';

import { useAttachments } from '../hooks/use-attachments';
import { useDeleteAttachment } from '../hooks/use-delete-attachment';
import { useUploadAttachments } from '../hooks/use-upload-attachments';
import { AttachmentList } from './attachment-list';
import { AttachmentUploadForm } from './attachment-upload-form';
import { formatFileSize } from '../utils/format-file-size';

type AttachmentsSectionProps = {
  recordId: string;
};

export function AttachmentsSection({ recordId }: AttachmentsSectionProps) {
  const attachmentsQuery = useAttachments(recordId);
  const uploadAttachmentsMutation = useUploadAttachments(recordId);
  const deleteAttachmentMutation = useDeleteAttachment(recordId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);

  async function handleUpload(files: File[]) {
    try {
      setActionError(null);
      await uploadAttachmentsMutation.mutateAsync(files);
      appToast.success({
        title: files.length > 1 ? 'Attachments uploaded' : 'Attachment uploaded',
        description:
          files.length > 1
            ? 'The files were linked to this maintenance record.'
            : 'The file was linked to this maintenance record.',
      });
    } catch (error) {
      const message = getApiErrorMessage(error, 'The attachment upload failed.');
      appToast.error({
        title: 'Unable to upload attachment',
        description: message,
      });
      setActionError(message);
    }
  }

  async function handleDelete(attachmentId: string) {
    try {
      setActionError(null);
      setDeletingAttachmentId(attachmentId);
      await deleteAttachmentMutation.mutateAsync(attachmentId);
      appToast.success({
        title: 'Attachment deleted',
        description: 'The file was removed from this maintenance record.',
      });
    } catch (error) {
      const message = getApiErrorMessage(error, 'The attachment delete failed.');
      appToast.error({
        title: 'Unable to delete attachment',
        description: message,
      });
      setActionError(message);
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  const attachmentsCount = attachmentsQuery.data?.length ?? 0;
  const totalSize = (attachmentsQuery.data ?? []).reduce((sum, attachment) => sum + attachment.size, 0);
  const latestAttachment = (attachmentsQuery.data ?? [])
    .slice()
    .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt))[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Receipts & Documents</CardTitle>
            <CardDescription>
              Upload and manage the supporting files linked to this maintenance event.
            </CardDescription>
          </div>
          <Badge tone="neutral">
            {attachmentsCount} file{attachmentsCount === 1 ? '' : 's'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <AttachmentUploadForm
          error={actionError}
          isUploading={uploadAttachmentsMutation.isPending}
          onUpload={handleUpload}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            description="Files currently linked to this maintenance record."
            icon={Paperclip}
            label="Attachments"
            value={String(attachmentsCount)}
          />
          <StatCard
            accent={
              latestAttachment ? (
                <span className="text-xs font-medium text-slate-500">
                  Latest {formatDate(latestAttachment.uploadedAt)}
                </span>
              ) : null
            }
            description="Combined file size of the linked receipts and documents."
            icon={ReceiptText}
            label="Stored size"
            value={formatFileSize(totalSize)}
          />
        </div>

        {attachmentsQuery.isPending ? (
          <LoadingState
            description="Fetching files linked to this maintenance record."
            title="Loading attachments"
          />
        ) : attachmentsQuery.isError ? (
          <ErrorState
            action={
              <Button onClick={() => attachmentsQuery.refetch()} variant="secondary">
                Retry
              </Button>
            }
            description="Attachments could not be loaded right now. Check that the API is running and try again."
            title="Unable to load attachments"
          />
        ) : attachmentsQuery.data.length ? (
          <AttachmentList
            attachments={attachmentsQuery.data}
            deletingAttachmentId={deletingAttachmentId}
            onDelete={handleDelete}
          />
        ) : (
          <EmptyState
            description="No receipts or documents are linked to this maintenance record yet. Upload the invoice, job card, or supporting photos so the record stays auditable later."
            title="No attachments yet"
          />
        )}
      </CardContent>
    </Card>
  );
}
