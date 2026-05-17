import { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Claim, ClaimExtractionSuggestion } from '@vehicle-vault/shared';

import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/toast';

import { getClaimAttachmentFileUrl } from '../api/claim-attachments';
import {
  useClaimAttachments,
  useClaimExtractionStatus,
  useDeleteClaimAttachment,
  useExtractClaimAttachment,
  useUploadClaimAttachments,
} from '../hooks/use-claim-attachments';
import { useUpdateClaim } from '../hooks/use-claims';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ClaimAttachmentsSectionProps {
  claim: Claim;
  vehicleId: string;
  /** When false, the section starts collapsed and only fetches on expand. */
  defaultExpanded?: boolean;
}

export function ClaimAttachmentsSection({
  claim,
  vehicleId,
  defaultExpanded = false,
}: ClaimAttachmentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [suggestion, setSuggestion] = useState<{
    attachmentId: string;
    data: ClaimExtractionSuggestion;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const attachmentsQuery = useClaimAttachments(claim.id, isExpanded);
  const extractionStatusQuery = useClaimExtractionStatus();
  const uploadMutation = useUploadClaimAttachments(claim.id);
  const deleteMutation = useDeleteClaimAttachment(claim.id);
  const extractMutation = useExtractClaimAttachment();
  const updateClaimMutation = useUpdateClaim(vehicleId);

  const attachments = attachmentsQuery.data ?? [];
  const ocrAvailable = extractionStatusQuery.data?.available === true;

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
      if (suggestion?.attachmentId === attachmentId) setSuggestion(null);
      appToast.success({ title: 'Attachment removed' });
    } catch {
      appToast.error({ title: 'Delete failed' });
    }
  }

  async function handleExtract(attachmentId: string) {
    try {
      const data = await extractMutation.mutateAsync(attachmentId);
      setSuggestion({ attachmentId, data });
      const hits = Object.values(data).filter(
        (v) => v !== undefined && v !== null && v !== '',
      ).length;
      if (hits === 0) {
        appToast.info({
          title: 'No claim fields detected',
          description: 'Try a clearer photo or a different document.',
        });
      }
    } catch {
      appToast.error({
        title: 'Extraction failed',
        description: 'AI could not read this document right now.',
      });
    }
  }

  async function handleApplySuggestion() {
    if (!suggestion) return;
    const { data } = suggestion;
    const patch: Parameters<typeof updateClaimMutation.mutateAsync>[0]['data'] = {};

    if (data.claimNumber) patch.claimNumber = data.claimNumber;
    if (typeof data.grossAmount === 'number') patch.grossAmount = data.grossAmount;
    if (typeof data.insurerPaidAmount === 'number') {
      patch.insurerPaidAmount = data.insurerPaidAmount;
    }
    if (data.filedDate) patch.filedDate = new Date(data.filedDate);
    if (data.settledDate) {
      patch.settledDate = new Date(data.settledDate);
      patch.status = 'settled';
    }
    if (data.notes && !claim.notes) patch.notes = data.notes;
    if (data.vendorName && !claim.notes) {
      patch.notes = patch.notes
        ? `${patch.notes}\n${data.vendorName}`
        : data.vendorName;
    }

    if (Object.keys(patch).length === 0) {
      appToast.info({ title: 'Nothing to apply' });
      return;
    }

    try {
      await updateClaimMutation.mutateAsync({ id: claim.id, data: patch });
      appToast.success({
        title: 'Claim updated from receipt',
        description: 'Fields merged. Review the card to confirm.',
      });
      setSuggestion(null);
    } catch {
      appToast.error({ title: 'Failed to apply suggestion' });
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
                    const isExtractingThis =
                      extractMutation.isPending && extractMutation.variables === att.id;
                    return (
                      <li
                        key={att.id}
                        className="rounded-md border border-slate-100 bg-slate-50/50 p-2 space-y-2"
                      >
                        <div className="flex items-center gap-2">
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
                          {ocrAvailable ? (
                            <button
                              type="button"
                              onClick={() => handleExtract(att.id)}
                              disabled={extractMutation.isPending}
                              className="text-indigo-500 hover:text-indigo-700 disabled:opacity-40"
                              aria-label="Extract claim fields"
                              title="Extract claim fields with AI"
                            >
                              {isExtractingThis ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}
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
                        </div>

                        {suggestion?.attachmentId === att.id ? (
                          <SuggestionPanel
                            suggestion={suggestion.data}
                            onApply={handleApplySuggestion}
                            onDismiss={() => setSuggestion(null)}
                            isApplying={updateClaimMutation.isPending}
                          />
                        ) : null}
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
                  {ocrAvailable
                    ? ' · ✨ AI can suggest claim fields from each file'
                    : ''}
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface SuggestionPanelProps {
  suggestion: ClaimExtractionSuggestion;
  onApply: () => void;
  onDismiss: () => void;
  isApplying: boolean;
}

function SuggestionPanel({ suggestion, onApply, onDismiss, isApplying }: SuggestionPanelProps) {
  const entries: Array<[string, string]> = [];
  if (suggestion.claimNumber) entries.push(['Claim #', suggestion.claimNumber]);
  if (typeof suggestion.grossAmount === 'number') {
    entries.push(['Gross bill', formatINR(suggestion.grossAmount)]);
  }
  if (typeof suggestion.insurerPaidAmount === 'number') {
    entries.push(['Insurer paid', formatINR(suggestion.insurerPaidAmount)]);
  }
  if (suggestion.filedDate) {
    entries.push(['Filed date', format(new Date(suggestion.filedDate), 'd MMM yyyy')]);
  }
  if (suggestion.settledDate) {
    entries.push(['Settled date', format(new Date(suggestion.settledDate), 'd MMM yyyy')]);
  }
  if (suggestion.vendorName) entries.push(['Vendor', suggestion.vendorName]);
  if (suggestion.notes) entries.push(['Notes', suggestion.notes]);

  const hasFindings = entries.length > 0;

  return (
    <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI Suggestion
          {typeof suggestion.confidence === 'number' ? (
            <span className="text-indigo-400 normal-case tracking-normal">
              · {Math.round(suggestion.confidence * 100)}% confidence
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-indigo-400 hover:text-indigo-700"
          aria-label="Dismiss suggestion"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {hasFindings ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {entries.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-bold text-slate-900 truncate">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-slate-500 italic">
          AI could not detect claim fields in this document.
        </p>
      )}

      {hasFindings ? (
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={onApply}
          disabled={isApplying}
        >
          <Check className="h-3 w-3" /> {isApplying ? 'Applying…' : 'Apply to claim'}
        </Button>
      ) : null}
    </div>
  );
}
