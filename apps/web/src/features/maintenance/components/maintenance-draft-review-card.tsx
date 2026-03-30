import { AlertCircle, CheckCircle2, Loader2, ScanText, Wand2 } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApplyAttachmentExtraction } from '@/features/attachments/hooks/use-apply-attachment-extraction';
import { useAttachments } from '@/features/attachments/hooks/use-attachments';
import { useAttachmentExtractionStatus } from '@/features/attachments/hooks/use-attachment-extraction-status';
import { useExtractAttachment } from '@/features/attachments/hooks/use-extract-attachment';
import type { AttachmentExtraction } from '@/features/attachments/types/attachment';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

type MaintenanceDraftReviewCardProps = {
  recordId: string;
};

export function MaintenanceDraftReviewCard({ recordId }: MaintenanceDraftReviewCardProps) {
  const attachmentsQuery = useAttachments(recordId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  const extractAttachmentMutation = useExtractAttachment(recordId);
  const applyAttachmentExtractionMutation = useApplyAttachmentExtraction(recordId);

  async function handleExtract(attachmentId: string) {
    try {
      await extractAttachmentMutation.mutateAsync(attachmentId);
      appToast.success({
        title: 'Document extracted',
        description: 'Review the suggested maintenance fields before saving the draft.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to extract document',
        description: getApiErrorMessage(error, 'The document could not be analyzed.'),
      });
    }
  }

  async function handleApply(attachmentId: string) {
    try {
      await applyAttachmentExtractionMutation.mutateAsync(attachmentId);
      appToast.success({
        title: 'Extraction applied',
        description: 'The draft form now reflects the suggested maintenance data.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to apply extraction',
        description: getApiErrorMessage(error, 'The suggested data could not be applied.'),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Document Review</CardTitle>
            <CardDescription>
              Extract invoice and job card data, then apply the suggestions into the draft.
            </CardDescription>
          </div>
          <Badge tone={extractionStatusQuery.data?.available ? 'accent' : 'warning'}>
            {extractionStatusQuery.data?.available ? 'OCR ready' : 'OCR unavailable'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {attachmentsQuery.isPending ? (
          <LoadingState
            description="Loading the files attached to this draft."
            title="Loading review documents"
          />
        ) : attachmentsQuery.isError ? (
          <ErrorState
            action={
              <Button onClick={() => attachmentsQuery.refetch()} variant="secondary">
                Retry
              </Button>
            }
            description="The linked draft documents could not be loaded."
            title="Unable to load draft documents"
          />
        ) : attachmentsQuery.data.length === 0 ? (
          <EmptyState
            description="Upload a receipt or job card first, then review the extracted data here."
            title="No draft documents yet"
          />
        ) : (
          attachmentsQuery.data.map((attachment) => (
            <div
              key={attachment.id}
              className="space-y-3 rounded-2xl border border-border/70 bg-slate-50/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{attachment.originalFileName}</p>
                    <ExtractionStatusBadge extraction={attachment.extraction} />
                  </div>
                  <p className="text-sm text-slate-500">
                    Uploaded{' '}
                    {formatDate(attachment.uploadedAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      !extractionStatusQuery.data?.available || extractAttachmentMutation.isPending
                    }
                    onClick={() => handleExtract(attachment.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {extractAttachmentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ScanText className="h-4 w-4" />
                    )}
                    {attachment.extraction ? 'Re-run OCR' : 'Run OCR'}
                  </Button>

                  {attachment.extraction?.status === 'completed' ? (
                    <Button
                      disabled={applyAttachmentExtractionMutation.isPending}
                      onClick={() => handleApply(attachment.id)}
                      size="sm"
                      type="button"
                    >
                      {applyAttachmentExtractionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      Apply to Draft
                    </Button>
                  ) : null}
                </div>
              </div>

              {attachment.extraction?.status === 'completed' ? (
                <ExtractionPreview extraction={attachment.extraction} />
              ) : attachment.extraction?.status === 'failed' ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {attachment.extraction.failureReason || 'The document could not be analyzed.'}
                </div>
              ) : !extractionStatusQuery.data?.available ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  OCR is not configured on the backend, so this draft can only use manual entry.
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-white/80 px-4 py-3 text-sm text-slate-500">
                  Run OCR to extract the document into structured maintenance fields.
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ExtractionPreview({ extraction }: { extraction: AttachmentExtraction }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ExtractionField
          label="Workshop / vendor"
          value={extraction.workshopName || extraction.vendorName}
        />
        <ExtractionField label="Invoice / job card" value={extraction.invoiceNumber} />
        <ExtractionField
          label="Service date"
          value={extraction.serviceDate ? formatDate(extraction.serviceDate) : undefined}
        />
        <ExtractionField
          label="Odometer"
          value={
            typeof extraction.odometer === 'number'
              ? `${extraction.odometer.toLocaleString('en-IN')} km`
              : undefined
          }
        />
        <ExtractionField
          label="Total"
          value={
            typeof extraction.totalCost === 'number'
              ? formatCurrency(extraction.totalCost, extraction.currencyCode)
              : undefined
          }
        />
        <ExtractionField
          label="Confidence"
          value={
            typeof extraction.confidence === 'number'
              ? `${Math.round(extraction.confidence * 100)}%`
              : undefined
          }
        />
      </div>

      {extraction.notes ? (
        <div className="rounded-xl border border-border/70 bg-white/80 px-4 py-3 text-sm text-slate-600">
          {extraction.notes}
        </div>
      ) : null}

      {extraction.lineItems?.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Suggested line items
          </p>
          <div className="space-y-2">
            {extraction.lineItems.map((lineItem, index) => (
              <div
                key={`${lineItem.name}-${index}`}
                className="flex flex-col gap-2 rounded-xl border border-border/70 bg-white px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{lineItem.name}</span>
                    <Badge tone="neutral">{lineItem.kind}</Badge>
                    {lineItem.normalizedCategory ? (
                      <Badge tone="neutral">{lineItem.normalizedCategory}</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500">
                    {[
                      typeof lineItem.quantity === 'number'
                        ? `${lineItem.quantity}${lineItem.unit ? ` ${lineItem.unit}` : ''}`
                        : undefined,
                      lineItem.brand,
                      lineItem.partNumber,
                    ]
                      .filter(Boolean)
                      .join(' • ') || 'No extra details'}
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {typeof lineItem.lineTotal === 'number'
                    ? formatCurrency(lineItem.lineTotal, extraction.currencyCode)
                    : 'No amount'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExtractionField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value || 'Not detected'}</p>
    </div>
  );
}

function ExtractionStatusBadge({ extraction }: { extraction?: AttachmentExtraction }) {
  if (!extraction) {
    return <Badge tone="neutral">Not analyzed</Badge>;
  }

  if (extraction.status === 'completed') {
    return (
      <Badge tone="accent">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Ready
      </Badge>
    );
  }

  if (extraction.status === 'failed') {
    return (
      <Badge tone="danger">
        <AlertCircle className="h-3.5 w-3.5" />
        Failed
      </Badge>
    );
  }

  return (
    <Badge tone="warning">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Pending
    </Badge>
  );
}
