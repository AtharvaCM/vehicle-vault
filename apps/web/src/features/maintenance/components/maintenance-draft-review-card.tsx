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
import { useExtractAttachments } from '@/features/attachments/hooks/use-extract-attachments';
import type { AttachmentExtraction } from '@/features/attachments/types/attachment';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

type MaintenanceDraftReviewCardProps = {
  recordId: string;
  /**
   * Applying writes the whole extraction over the record and leaves it a draft,
   * so it is offered for a draft only. A confirmed record is filled in from its
   * record page instead, which adds only what it is missing.
   */
  isDraft: boolean;
};

export function MaintenanceDraftReviewCard({ recordId, isDraft }: MaintenanceDraftReviewCardProps) {
  const attachmentsQuery = useAttachments(recordId);
  const extractionStatusQuery = useAttachmentExtractionStatus();
  const extractAttachmentMutation = useExtractAttachment(recordId);
  const extractAttachmentsMutation = useExtractAttachments(recordId);
  const applyAttachmentExtractionMutation = useApplyAttachmentExtraction(recordId);
  const attachments = attachmentsQuery.data ?? [];
  const isExtracting = extractAttachmentMutation.isPending || extractAttachmentsMutation.isPending;

  async function handleExtract(attachmentId: string) {
    try {
      await extractAttachmentMutation.mutateAsync(attachmentId);
      appToast.success({
        title: 'Document extracted',
        description: 'Review the suggested service fields before saving the draft.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to extract document',
        description: getApiErrorMessage(error, 'The document could not be analyzed.'),
      });
    }
  }

  async function handleExtractAll() {
    try {
      await extractAttachmentsMutation.mutateAsync(attachments.map((attachment) => attachment.id));
      appToast.success({
        title: 'Documents extracted',
        description: 'Review the merged service fields before saving the draft.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to extract documents',
        description: getApiErrorMessage(error, 'The documents could not be analyzed together.'),
      });
    }
  }

  async function handleApply(attachmentId: string) {
    try {
      await applyAttachmentExtractionMutation.mutateAsync(attachmentId);
      appToast.success({
        title: 'Extraction applied',
        description: 'The draft form now reflects the suggested service data.',
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
            <CardTitle>Document review</CardTitle>
            <CardDescription>
              {isDraft
                ? 'Extract invoice and job card data, then apply the suggestions into the draft.'
                : 'What was read from the invoice and job card. To add what this record is missing, use Fill in from photo on the record page.'}
            </CardDescription>
          </div>
          <Badge tone={extractionStatusQuery.data?.available ? 'accent' : 'warning'}>
            {extractionStatusQuery.data?.available ? 'OCR ready' : 'OCR unavailable'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {attachments.length > 1 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-fg">Multi-page document OCR</p>
              <p className="text-sm text-fg-2">
                Extract all attached pages together into one merged service suggestion.
              </p>
            </div>
            <Button
              disabled={!extractionStatusQuery.data?.available || isExtracting}
              onClick={handleExtractAll}
              size="sm"
              type="button"
              variant="secondary"
            >
              {extractAttachmentsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanText className="h-4 w-4" />
              )}
              Run OCR on all
            </Button>
          </div>
        ) : null}

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
        ) : attachments.length === 0 ? (
          <EmptyState
            description="Upload a receipt or job card first, then review the extracted data here."
            title="No draft documents yet"
          />
        ) : (
          attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="space-y-3 rounded-2xl border border-border/70 bg-page/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-fg">{attachment.originalFileName}</p>
                    <ExtractionStatusBadge extraction={attachment.extraction} />
                  </div>
                  <p className="text-sm text-fg-3">
                    Uploaded {format.date(attachment.uploadedAt, 'dateTime')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!extractionStatusQuery.data?.available || isExtracting}
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
                    {attachment.extraction ? 'Read again' : 'Run OCR'}
                  </Button>

                  {isDraft && attachment.extraction?.status === 'completed' ? (
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
                      Apply to draft
                    </Button>
                  ) : null}
                </div>
              </div>

              {attachment.extraction?.status === 'completed' ? (
                <ExtractionPreview extraction={attachment.extraction} />
              ) : attachment.extraction?.status === 'failed' ? (
                <div className="rounded-xl border border-late/30 bg-late-tint px-4 py-3 text-sm text-late">
                  {attachment.extraction.failureReason || 'The document could not be analyzed.'}
                </div>
              ) : !extractionStatusQuery.data?.available ? (
                <div className="rounded-xl border border-soon/30 bg-soon-tint px-4 py-3 text-sm text-soon">
                  OCR is not configured on the backend, so this draft can only use manual entry.
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-surface/80 px-4 py-3 text-sm text-fg-3">
                  Run OCR to extract the document into structured service fields.
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
  // The API applies the same fallback when it writes the draft, so the preview has to
  // match it. Providers routinely return only a document date, and showing "Not detected"
  // for a date that will in fact be applied reads as a failed extraction.
  const serviceDate = extraction.serviceDate ?? extraction.documentDate;

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
          value={serviceDate ? format.date(serviceDate) : undefined}
        />
        <ExtractionField
          label="Odometer"
          value={
            typeof extraction.odometer === 'number'
              ? format.odometer(extraction.odometer)
              : undefined
          }
        />
        <ExtractionField
          label="Total"
          value={
            typeof extraction.totalCost === 'number'
              ? format.money(extraction.totalCost, { currency: extraction.currencyCode })
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
        <ExtractionField
          label="Next due date"
          value={extraction.nextDueDate ? format.date(extraction.nextDueDate) : undefined}
        />
        <ExtractionField
          label="Next due odometer"
          value={
            typeof extraction.nextDueOdometer === 'number'
              ? format.odometer(extraction.nextDueOdometer)
              : undefined
          }
        />
      </div>

      {extraction.notes ? (
        <div className="rounded-xl border border-border/70 bg-surface/80 px-4 py-3 text-sm text-fg-2">
          {extraction.notes}
        </div>
      ) : null}

      {extraction.lineItems?.length ? (
        <div className="space-y-2">
          <p className="text-caption font-medium text-fg-3">Suggested line items</p>
          <div className="space-y-2">
            {extraction.lineItems.map((lineItem, index) => (
              <div
                key={`${lineItem.name}-${index}`}
                className="flex flex-col gap-2 rounded-xl border border-border/70 bg-surface px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">{lineItem.name}</span>
                    <Badge tone="neutral">
                      {format.enumLabel('maintenanceLineItemKind', lineItem.kind)}
                    </Badge>
                    {lineItem.normalizedCategory ? (
                      <Badge tone="neutral">
                        {format.enumLabel('maintenanceCategory', lineItem.normalizedCategory)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-fg-3">
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
                <div className="text-sm font-semibold text-fg">
                  {typeof lineItem.lineTotal === 'number'
                    ? format.money(lineItem.lineTotal, { currency: extraction.currencyCode })
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

// A plain label/value pair, not the shared Figure: this preview sits beside the
// form on the same page, and Figure's aria-labelledby group would give "Odometer"
// two accessible matches for getByLabel('Odometer') — the form input and this.
function ExtractionField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface/80 px-4 py-3">
      <p className="text-caption font-medium text-fg-3">{label}</p>
      <p className="mt-1 text-sm text-fg">{value || 'Not detected'}</p>
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
