import { useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useAttachments } from '../hooks/use-attachments';
import { useDeleteAttachment } from '../hooks/use-delete-attachment';
import { useUploadAttachments } from '../hooks/use-upload-attachments';
import { AttachmentList } from './attachment-list';
import { AttachmentUploadForm } from './attachment-upload-form';

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
      setActionError(getApiErrorMessage(error, 'The attachment upload failed.'));
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
      setActionError(getApiErrorMessage(error, 'The attachment delete failed.'));
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  const attachmentsCount = attachmentsQuery.data?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipts & Documents</CardTitle>
        <CardDescription>
          Upload receipt images or PDFs linked to this maintenance record. {attachmentsCount} file
          {attachmentsCount === 1 ? '' : 's'} attached.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <AttachmentUploadForm
          error={null}
          isUploading={uploadAttachmentsMutation.isPending}
          onUpload={handleUpload}
        />

        {actionError ? <InlineError message={actionError} /> : null}

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
            description="No receipts or documents are linked to this maintenance record yet. Use the upload control above to add the first file."
            title="No attachments yet"
          />
        )}
      </CardContent>
    </Card>
  );
}
