import { MaintenanceRecordStatus } from '@vehicle-vault/shared';
import { useState } from 'react';
import { Paperclip, ReceiptText } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { useAttachmentExtractionStatus } from '../hooks/use-attachment-extraction-status';
import { useAttachments } from '../hooks/use-attachments';
import { useDeleteAttachment } from '../hooks/use-delete-attachment';
import { useUploadAttachments } from '../hooks/use-upload-attachments';
import { AttachmentList } from './attachment-list';
import { AttachmentUploadForm } from './attachment-upload-form';
import { FillFromPhotoDialog } from './fill-from-photo-dialog';
import { formatFileSize } from '../utils/format-file-size';

type AttachmentsSectionProps = {
  recordId: string;
  /**
   * The record its files can fill in, offered only where nothing typed is open
   * to lose: the record page passes it, the edit page does not, since writing to
   * the record under its form would reset what is being typed there.
   */
  recordToFill?: MaintenanceRecord;
};

export function AttachmentsSection({ recordId, recordToFill }: AttachmentsSectionProps) {
  const { canEdit, role } = useVehicleAccess();
  const attachmentsQuery = useAttachments(recordId);
  const uploadAttachmentsMutation = useUploadAttachments(recordId);
  const deleteAttachmentMutation = useDeleteAttachment(recordId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [fillingFromId, setFillingFromId] = useState<string | null>(null);

  // Filling in is an edit, so it waits for a known editor role rather than
  // showing while the role loads; it needs the extractor configured on the API;
  // and it is for confirmed records, since a draft takes the whole extraction on
  // its edit page.
  const canFillIn =
    recordToFill !== undefined &&
    recordToFill.status !== MaintenanceRecordStatus.Draft &&
    role !== null &&
    canEdit &&
    extractionStatusQuery.data?.available === true;
  const fillingFrom = attachmentsQuery.data?.find((attachment) => attachment.id === fillingFromId);

  async function handleUpload(files: File[]) {
    try {
      setActionError(null);
      await uploadAttachmentsMutation.mutateAsync(files);
      appToast.success({
        title: files.length > 1 ? 'Attachments uploaded' : 'Attachment uploaded',
        description:
          files.length > 1
            ? 'The files were added to this service record.'
            : 'The file was added to this service record.',
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "We couldn't upload this file.");
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
        description: 'The file was removed from this service record.',
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "We couldn't delete this file.");
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
  const totalSize = (attachmentsQuery.data ?? []).reduce(
    (sum, attachment) => sum + attachment.size,
    0,
  );
  const latestAttachment = (attachmentsQuery.data ?? [])
    .slice()
    .sort((left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt))[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Receipts & documents</CardTitle>
            <CardDescription>
              {canEdit
                ? 'Upload and manage the supporting files linked to this service record.'
                : 'The supporting files linked to this service record. You can open them, but not change them.'}
            </CardDescription>
          </div>
          <Badge tone="neutral">
            {attachmentsCount} file{attachmentsCount === 1 ? '' : 's'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {canEdit ? (
          <AttachmentUploadForm
            error={actionError}
            isUploading={uploadAttachmentsMutation.isPending}
            onUpload={handleUpload}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            description="Files currently linked to this service record."
            icon={Paperclip}
            label="Attachments"
            value={String(attachmentsCount)}
          />
          <StatCard
            accent={
              latestAttachment ? (
                <span className="text-xs font-medium text-slate-500">
                  Latest {format.date(latestAttachment.uploadedAt)}
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
            description="Loading files linked to this service record."
            title="Loading attachments"
          />
        ) : attachmentsQuery.isError ? (
          <ErrorState
            action={
              <Button onClick={() => attachmentsQuery.refetch()} variant="secondary">
                Retry
              </Button>
            }
            description="We couldn't load the receipts and documents for this record. Try again in a moment."
            title="Unable to load attachments"
          />
        ) : attachmentsQuery.data.length ? (
          <AttachmentList
            attachments={attachmentsQuery.data}
            deletingAttachmentId={deletingAttachmentId}
            onDelete={canEdit ? handleDelete : undefined}
            onFillFromPhoto={
              canFillIn ? (attachment) => setFillingFromId(attachment.id) : undefined
            }
          />
        ) : (
          <EmptyState
            description={
              canEdit
                ? 'No receipts or documents are linked to this service record yet. Upload an invoice, job card, or supporting photos so you can find them later.'
                : 'No receipts or documents are linked to this service record yet.'
            }
            title="No attachments yet"
          />
        )}

        {canFillIn && fillingFrom ? (
          <FillFromPhotoDialog
            attachment={fillingFrom}
            key={fillingFrom.id}
            onClose={() => setFillingFromId(null)}
            record={recordToFill}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
