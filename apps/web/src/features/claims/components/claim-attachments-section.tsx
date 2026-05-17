import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { Input } from '@/components/ui/input';
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

const ACCEPT =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toDateInputValue(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
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

  async function handleApplySuggestion(edited: ClaimExtractionSuggestion) {
    const patch: Parameters<typeof updateClaimMutation.mutateAsync>[0]['data'] = {};

    if (edited.claimNumber) patch.claimNumber = edited.claimNumber;
    if (typeof edited.grossAmount === 'number') patch.grossAmount = edited.grossAmount;
    if (typeof edited.insurerPaidAmount === 'number') {
      patch.insurerPaidAmount = edited.insurerPaidAmount;
    }
    if (edited.filedDate) patch.filedDate = new Date(edited.filedDate);
    if (edited.settledDate) {
      patch.settledDate = new Date(edited.settledDate);
      patch.status = 'settled';
    }
    if (edited.notes && !claim.notes) patch.notes = edited.notes;
    if (edited.vendorName && !claim.notes) {
      patch.notes = patch.notes ? `${patch.notes}\n${edited.vendorName}` : edited.vendorName;
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
                  JPEG, PNG, WEBP, HEIC, or PDF · up to 5 MB each
                  {ocrAvailable ? ' · ✨ AI can suggest claim fields from each file' : ''}
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

type FieldKey =
  | 'claimNumber'
  | 'grossAmount'
  | 'insurerPaidAmount'
  | 'filedDate'
  | 'settledDate'
  | 'vendorName'
  | 'notes';

const FIELD_LABEL: Record<FieldKey, string> = {
  claimNumber: 'Claim #',
  grossAmount: 'Gross bill (₹)',
  insurerPaidAmount: 'Insurer paid (₹)',
  filedDate: 'Filed date',
  settledDate: 'Settled date',
  vendorName: 'Vendor',
  notes: 'Notes',
};

type DraftState = {
  values: Record<FieldKey, string>;
  included: Record<FieldKey, boolean>;
};

function suggestionToDraft(s: ClaimExtractionSuggestion): DraftState {
  return {
    values: {
      claimNumber: s.claimNumber ?? '',
      grossAmount: typeof s.grossAmount === 'number' ? String(s.grossAmount) : '',
      insurerPaidAmount: typeof s.insurerPaidAmount === 'number' ? String(s.insurerPaidAmount) : '',
      filedDate: toDateInputValue(s.filedDate),
      settledDate: toDateInputValue(s.settledDate),
      vendorName: s.vendorName ?? '',
      notes: s.notes ?? '',
    },
    included: {
      claimNumber: Boolean(s.claimNumber),
      grossAmount: typeof s.grossAmount === 'number',
      insurerPaidAmount: typeof s.insurerPaidAmount === 'number',
      filedDate: Boolean(s.filedDate),
      settledDate: Boolean(s.settledDate),
      vendorName: Boolean(s.vendorName),
      notes: Boolean(s.notes),
    },
  };
}

function draftToSuggestion(draft: DraftState): ClaimExtractionSuggestion {
  const out: ClaimExtractionSuggestion = {};
  if (draft.included.claimNumber && draft.values.claimNumber.trim()) {
    out.claimNumber = draft.values.claimNumber.trim();
  }
  if (draft.included.grossAmount && draft.values.grossAmount.trim()) {
    const n = Number(draft.values.grossAmount);
    if (!Number.isNaN(n) && n >= 0) out.grossAmount = n;
  }
  if (draft.included.insurerPaidAmount && draft.values.insurerPaidAmount.trim()) {
    const n = Number(draft.values.insurerPaidAmount);
    if (!Number.isNaN(n) && n >= 0) out.insurerPaidAmount = n;
  }
  if (draft.included.filedDate && draft.values.filedDate) {
    out.filedDate = new Date(draft.values.filedDate).toISOString();
  }
  if (draft.included.settledDate && draft.values.settledDate) {
    out.settledDate = new Date(draft.values.settledDate).toISOString();
  }
  if (draft.included.vendorName && draft.values.vendorName.trim()) {
    out.vendorName = draft.values.vendorName.trim();
  }
  if (draft.included.notes && draft.values.notes.trim()) {
    out.notes = draft.values.notes.trim();
  }
  return out;
}

interface SuggestionPanelProps {
  suggestion: ClaimExtractionSuggestion;
  onApply: (edited: ClaimExtractionSuggestion) => void;
  onDismiss: () => void;
  isApplying: boolean;
}

function SuggestionPanel({ suggestion, onApply, onDismiss, isApplying }: SuggestionPanelProps) {
  const [draft, setDraft] = useState<DraftState>(() => suggestionToDraft(suggestion));

  // Re-seed when the underlying suggestion changes (different attachment extracted).
  useEffect(() => {
    setDraft(suggestionToDraft(suggestion));
  }, [suggestion]);

  const hasInitialFindings = Object.values(suggestionToDraft(suggestion).included).some(Boolean);
  const anyIncluded = Object.values(draft.included).some(Boolean);

  function setValue(key: FieldKey, value: string) {
    setDraft((prev) => ({
      values: { ...prev.values, [key]: value },
      // Editing a field implicitly includes it.
      included: { ...prev.included, [key]: true },
    }));
  }

  function toggleIncluded(key: FieldKey) {
    setDraft((prev) => ({
      ...prev,
      included: { ...prev.included, [key]: !prev.included[key] },
    }));
  }

  function renderField(key: FieldKey, input: ReactNode) {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.included[key]}
          onChange={() => toggleIncluded(key)}
          className="h-3 w-3 accent-indigo-600"
        />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 w-28 shrink-0">
          {FIELD_LABEL[key]}
        </span>
        <div className="flex-1">{input}</div>
      </label>
    );
  }

  return (
    <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI Suggestion (editable)
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

      {hasInitialFindings ? (
        <>
          <p className="text-[10px] text-slate-500">
            Uncheck a field to skip it. Edit values to correct OCR mistakes before applying.
          </p>
          <div className="space-y-2">
            {renderField(
              'claimNumber',
              <Input
                value={draft.values.claimNumber}
                onChange={(e) => setValue('claimNumber', e.target.value)}
                placeholder="e.g. CL-2026-1234"
                className="h-8 text-xs"
              />,
            )}
            {renderField(
              'grossAmount',
              <Input
                type="number"
                step="0.01"
                value={draft.values.grossAmount}
                onChange={(e) => setValue('grossAmount', e.target.value)}
                className="h-8 text-xs"
              />,
            )}
            {renderField(
              'insurerPaidAmount',
              <Input
                type="number"
                step="0.01"
                value={draft.values.insurerPaidAmount}
                onChange={(e) => setValue('insurerPaidAmount', e.target.value)}
                className="h-8 text-xs"
              />,
            )}
            {renderField(
              'filedDate',
              <Input
                type="date"
                value={draft.values.filedDate}
                onChange={(e) => setValue('filedDate', e.target.value)}
                className="h-8 text-xs"
              />,
            )}
            {renderField(
              'settledDate',
              <Input
                type="date"
                value={draft.values.settledDate}
                onChange={(e) => setValue('settledDate', e.target.value)}
                className="h-8 text-xs"
              />,
            )}
            {renderField(
              'vendorName',
              <Input
                value={draft.values.vendorName}
                onChange={(e) => setValue('vendorName', e.target.value)}
                className="h-8 text-xs"
              />,
            )}
            {renderField(
              'notes',
              <Input
                value={draft.values.notes}
                onChange={(e) => setValue('notes', e.target.value)}
                className="h-8 text-xs"
              />,
            )}
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => onApply(draftToSuggestion(draft))}
            disabled={isApplying || !anyIncluded}
          >
            <Check className="h-3 w-3" /> {isApplying ? 'Applying…' : 'Apply to claim'}
          </Button>
        </>
      ) : (
        <p className="text-xs text-slate-500 italic">
          AI could not detect claim fields in this document.
        </p>
      )}
    </div>
  );
}
