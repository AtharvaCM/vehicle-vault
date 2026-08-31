import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatFileSize } from '@/features/attachments/utils/format-file-size';
import { InlineError } from '@/components/shared/inline-error';
import { endpoints } from '@/lib/api/endpoints';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { openApiFileInNewTab } from '@/lib/api/open-api-file';
import { appToast } from '@/lib/toast';

import {
  useDeleteLoanAttachment,
  useLoanAttachments,
  useUploadLoanAttachments,
} from '../hooks/use-loan-attachments';

type Props = {
  loanId: string;
};

export function LoanAttachmentsSection({ loanId }: Props) {
  const query = useLoanAttachments(loanId);
  const upload = useUploadLoanAttachments(loanId);
  const del = useDeleteLoanAttachment(loanId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const attachments = query.data ?? [];

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingFiles(Array.from(event.target.files ?? []));
  };

  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    try {
      await upload.mutateAsync(pendingFiles);
      appToast.success({ title: `${pendingFiles.length} file(s) uploaded` });
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Upload failed') });
    }
  };

  const handleOpen = async (attachmentId: string) => {
    try {
      await openApiFileInNewTab(endpoints.attachments.file(attachmentId));
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not open attachment') });
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await del.mutateAsync(attachmentId);
      appToast.success({ title: 'Attachment removed' });
    } catch (error) {
      appToast.error({ title: getApiErrorMessage(error, 'Could not remove attachment') });
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Documents</h3>
        <span className="text-xs text-muted-foreground">
          Sanction letter, agreement, statements, NOC
        </span>
      </header>

      {query.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <InlineError
          message={getApiErrorMessage(
            query.error,
            "Couldn't load attachments for this loan — they have not been deleted.",
          )}
        />
      ) : attachments.length ? (
        <ul className="divide-y divide-border text-sm">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-2 py-2">
              <button
                type="button"
                onClick={() => handleOpen(att.id)}
                className="flex min-w-0 flex-1 flex-col text-left hover:underline"
              >
                <span className="truncate font-medium">{att.originalFileName}</span>
                <span className="text-xs text-muted-foreground">
                  {att.kind} · {formatFileSize(att.size)} ·{' '}
                  {new Date(att.uploadedAt).toLocaleDateString()}
                </span>
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={del.isPending}
                onClick={() => handleDelete(att.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No documents attached yet.</p>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-1">
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
          onChange={handleFilesChange}
          className="max-w-sm cursor-pointer"
        />
        <Button onClick={handleUpload} disabled={!pendingFiles.length || upload.isPending}>
          {upload.isPending ? 'Uploading…' : `Upload${pendingFiles.length ? ` ${pendingFiles.length}` : ''}`}
        </Button>
      </div>
    </section>
  );
}
