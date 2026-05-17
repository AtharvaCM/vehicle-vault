import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileText, Image as ImageIcon, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/toast';

import {
  getClaimAttachmentFileUrl,
} from '../api/claim-attachments';
import {
  useClaimAttachments,
  useDeleteClaimAttachment,
  useUploadClaimAttachments,
} from '../hooks/use-claim-attachments';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ClaimAttachmentsSectionProps {
  claimId: string;
  /** When false, the section starts collapsed and only fetches on expand. */
  defaultExpanded?: boolean;
}

export function ClaimAttachmentsSection({
  claimId,
  defaultExpanded = false,
}: ClaimAttachmentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const attachmentsQuery = useClaimAttachments(claimId, isExpanded);
  const uploadMutation = useUploadClaimAttachments(claimId);
  const deleteMutation = useDeleteClaimAttachment(claimId);

  const attachments = attachmentsQuery.data ?? [];

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    try {
      await uploadMutation.mutateAsync(files);
      appToast.success({
        title: `Uploaded ${files.length} file${files.length === 1 ? '' : 's'}`,
        description: 'Receipts attached to this claim.',
      });
    } catch {
      appToast.error({
        title: 'Upload failed',
        description: 'Check file size and format, then try again.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(attachmentId: string) {
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteMutation.mutateAsync(attachmentId);
      appToast.success({ title: 'Attachment removed' });
    } catch {
      appToast.error({ title: 'Delete failed' });
    }
  }

  return (
    <div className="space-y-2 pt-3 border-t border-slate-100">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-xs text-slate-600 hover:text-slate-900 transition-colors"
      >
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[10px]">
          <Paperclip className="h-3 w-3" />
          Receipts &amp; Documents
          {attachments.length > 0 ? (
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black tabular-nums">
              {attachments.length}
            </span>
          ) : null}
        </span>
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isExpanded ? (
        <div className="space-y-3 pt-2">
          {attachmentsQuery.isPending ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : (
            <>
              {attachments.length > 0 ? (
                <ul className="space-y-2">
                  {attachments.map((att) => {
                    const Icon = att.kind === 'image' ? ImageIcon : FileText;
                    return (
                      <li
                        key={att.id}
                        className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/50 p-2"
                      >
                        <Icon className="h-4 w-4 text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {att.originalFileName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatBytes(att.size)} ·{' '}
                            {format(new Date(att.uploadedAt), 'd MMM yyyy')}
                          </p>
                        </div>
                        <a
                          href={getClaimAttachmentFileUrl(att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-slate-900"
                          aria-label="Download attachment"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(att.id)}
                          disabled={deleteMutation.isPending}
                          className="text-rose-400 hover:text-rose-600"
                          aria-label="Delete attachment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">No attachments yet.</p>
              )}

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="h-4 w-4" />
                  {uploadMutation.isPending ? 'Uploading…' : 'Upload receipts / photos'}
                </Button>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  JPEG, PNG, WEBP, or PDF · up to 5 MB each
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
