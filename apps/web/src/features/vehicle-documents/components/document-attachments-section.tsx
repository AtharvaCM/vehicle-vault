import { Paperclip } from 'lucide-react';
import { useRef } from 'react';

import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/features/attachments/utils/format-file-size';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';
import { endpoints } from '@/lib/api/endpoints';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { openApiFileInNewTab } from '@/lib/api/open-api-file';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import type { DocumentWithFilesKind } from '../api/document-attachments';
import {
  useDeleteDocumentAttachment,
  useDocumentAttachments,
  useUploadDocumentAttachments,
} from '../hooks/use-document-attachments';

/** The same types the API's attachment filter accepts. */
const ACCEPTED_FILES =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

type DocumentAttachmentsSectionProps = {
  kind: DocumentWithFilesKind;
  documentId: string;
};

/** What to suggest adding, in the document's own terms. */
const EMPTY_HINT: Record<DocumentWithFilesKind, string> = {
  insurance: 'Add the policy PDF or a photo of the document.',
  warranty: 'Add the warranty card or certificate.',
  registration: 'Add a photo of the registration certificate.',
  puc: 'Add a photo of the PUC certificate.',
  road_tax: 'Add the road tax receipt.',
};

/**
 * The document itself, kept with the record of it: the policy PDF, a photo of
 * the RC or PUC certificate that gets asked for at a checkpoint. Anyone the
 * vehicle is shared with can open the files; adding and removing them is an
 * edit, so a viewer gets the list alone.
 */
export function DocumentAttachmentsSection({ documentId, kind }: DocumentAttachmentsSectionProps) {
  const { canEdit } = useVehicleAccess();
  const attachmentsQuery = useDocumentAttachments(kind, documentId);
  const upload = useUploadDocumentAttachments(kind, documentId);
  const remove = useDeleteDocumentAttachment(kind, documentId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const attachments = attachmentsQuery.data ?? [];

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    try {
      await upload.mutateAsync(files);
      appToast.success({
        title: files.length === 1 ? 'File added' : `${files.length} files added`,
      });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Upload failed') });
    }
  }

  async function handleOpen(attachmentId: string) {
    try {
      await openApiFileInNewTab(endpoints.attachments.file(attachmentId));
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not open the file') });
    }
  }

  async function handleRemove(attachmentId: string) {
    try {
      await remove.mutateAsync(attachmentId);
      appToast.success({ title: 'File removed' });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not remove the file') });
    }
  }

  return (
    <section aria-label="Document files" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Paperclip aria-hidden="true" className="h-3 w-3" />
          Files
        </p>
        {canEdit ? (
          <>
            <input
              accept={ACCEPTED_FILES}
              aria-label="Add files to this document"
              capture="environment"
              className="hidden"
              multiple
              onChange={(event) => void handleFiles(event)}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={upload.isPending}
              onClick={() => fileInputRef.current?.click()}
              size="xs"
              variant="outline"
            >
              {upload.isPending ? 'Uploading…' : 'Add file'}
            </Button>
          </>
        ) : null}
      </div>

      {attachmentsQuery.isPending ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : attachmentsQuery.isError ? (
        <InlineError
          message={getApiErrorMessage(
            attachmentsQuery.error,
            "Couldn't load this document's files. They have not been deleted.",
          )}
        />
      ) : attachments.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {attachments.map((attachment) => (
            <li className="flex items-center justify-between gap-2 py-1.5" key={attachment.id}>
              <button
                className="flex min-w-0 flex-1 flex-col text-left hover:underline"
                onClick={() => void handleOpen(attachment.id)}
                type="button"
              >
                <span className="truncate font-medium text-slate-700">
                  {attachment.originalFileName}
                </span>
                <span className="text-xs text-slate-400">
                  {formatFileSize(attachment.size)} · {format.date(attachment.uploadedAt)}
                </span>
              </button>
              {canEdit ? (
                <Button
                  aria-label={`Remove ${attachment.originalFileName}`}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  disabled={remove.isPending}
                  onClick={() => void handleRemove(attachment.id)}
                  size="xs"
                  variant="ghost"
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">
          {canEdit ? `No files yet. ${EMPTY_HINT[kind]}` : 'No files yet.'}
        </p>
      )}
    </section>
  );
}
