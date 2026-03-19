import { useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';

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
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  }

  async function handleDelete(attachmentId: string) {
    try {
      setActionError(null);
      setDeletingAttachmentId(attachmentId);
      await deleteAttachmentMutation.mutateAsync(attachmentId);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
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
          error={actionError}
          isUploading={uploadAttachmentsMutation.isPending}
          onUpload={handleUpload}
        />

        {attachmentsQuery.isPending ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Loading linked attachments.
          </p>
        ) : attachmentsQuery.isError ? (
          <EmptyState
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
            description="No receipts or documents are linked to this maintenance record yet."
            title="No attachments yet"
          />
        )}
      </CardContent>
    </Card>
  );
}

function getApiErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    error.data &&
    typeof error.data === 'object' &&
    'error' in error.data &&
    error.data.error &&
    typeof error.data.error === 'object' &&
    'message' in error.data.error &&
    typeof error.data.error.message === 'string'
  ) {
    return error.data.error.message;
  }

  return error instanceof Error ? error.message : 'The attachment action failed.';
}
