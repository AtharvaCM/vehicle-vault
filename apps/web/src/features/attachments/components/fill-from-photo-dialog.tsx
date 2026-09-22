import { AttachmentExtractionStatus } from '@vehicle-vault/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';
import { formatMaintenanceCategory } from '@/features/maintenance/utils/format-maintenance-category';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import { useExtractAttachment } from '../hooks/use-extract-attachment';
import { useFillFromAttachment } from '../hooks/use-fill-from-attachment';
import { useFillPlan } from '../hooks/use-fill-plan';
import type { Attachment, MaintenanceFillField, MaintenanceFillPlan } from '../types/attachment';

type FillFromPhotoDialogProps = {
  attachment: Attachment;
  /** The confirmed record the attachment belongs to. */
  record: MaintenanceRecord;
  onClose: () => void;
};

const FIELD_LABELS: Record<MaintenanceFillField, string> = {
  category: 'Category',
  workshopName: 'Workshop',
  invoiceNumber: 'Invoice / job card',
  notes: 'Notes',
  lineItems: 'Line items',
  nextDueDate: 'Next due date',
  nextDueOdometer: 'Next due odometer',
};

const FIELD_ADDED: Record<MaintenanceFillField, string> = {
  category: 'the category',
  workshopName: 'the workshop',
  invoiceNumber: 'the invoice number',
  notes: 'notes',
  lineItems: 'line items',
  nextDueDate: 'the next due date',
  nextDueOdometer: 'the next due odometer',
};

/**
 * "Fill in from photo" on a confirmed record (#116). Opening it is the request to
 * read the file, unless it was read before; it then shows what that adds to the
 * record and writes it once agreed. The API decides what to add — only fields the
 * record leaves blank, never the date, odometer or cost that were typed — so the
 * list shown is what the fill writes.
 */
export function FillFromPhotoDialog({ attachment, record, onClose }: FillFromPhotoDialogProps) {
  const { mutate: read, ...reading } = useExtractAttachment(record.id);
  const fill = useFillFromAttachment();
  const readBefore = attachment.extraction?.status === AttachmentExtractionStatus.Completed;
  const isRead = !reading.isPending && !reading.isError && (readBefore || reading.isSuccess);
  const plan = useFillPlan(attachment.id, { enabled: isRead });
  const noun = attachment.mimeType === 'application/pdf' ? 'PDF' : 'photo';

  // A file read before is not read again unless someone asks.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || readBefore) return;
    asked.current = true;
    read(attachment.id);
  }, [attachment.id, read, readBefore]);

  async function handleFill() {
    try {
      const { filledFields } = await fill.mutateAsync(attachment.id);
      if (filledFields.length) {
        appToast.success({
          title: `Filled in from the ${noun}`,
          description: `Added ${listOf(filledFields.map((field) => FIELD_ADDED[field]))}.`,
        });
      } else {
        appToast.info({
          title: 'Nothing left to fill in',
          description: `The record already has everything the ${noun} shows.`,
        });
      }
      onClose();
    } catch (error) {
      appToast.error({
        title: "Couldn't fill in the record",
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fill in from the {noun}</DialogTitle>
          <DialogDescription>
            Only what this record is missing. The date, odometer and cost stay as you logged them.
          </DialogDescription>
        </DialogHeader>

        {reading.isError ? (
          <Problem>{getApiErrorMessage(reading.error, `The ${noun} couldn't be read.`)}</Problem>
        ) : !isRead ? (
          <Progress>Reading the {noun}…</Progress>
        ) : plan.isPending ? (
          <Progress>Checking what this record is missing…</Progress>
        ) : plan.isError ? (
          <Problem>{getApiErrorMessage(plan.error, "Couldn't work out what to fill in.")}</Problem>
        ) : (
          <FillPlanSummary noun={noun} plan={plan.data} record={record} />
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            disabled={reading.isPending || fill.isPending}
            onClick={() => read(attachment.id)}
            type="button"
            variant="ghost"
          >
            {reading.isError ? 'Try again' : `Read the ${noun} again`}
          </Button>
          <Button
            disabled={!isRead || !plan.data?.fields.length || fill.isPending}
            onClick={handleFill}
            type="button"
          >
            {fill.isPending ? 'Filling in…' : 'Fill in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FillPlanSummary({
  noun,
  plan,
  record,
}: {
  noun: string;
  plan: MaintenanceFillPlan;
  record: MaintenanceRecord;
}) {
  const leftOut = plan.lineItemsLeftOut ? (
    <p className="text-sm text-slate-600">
      Line items left out: they come to{' '}
      {formatCurrency(plan.lineItemsLeftOut.total, record.currencyCode)}, and this record&apos;s
      cost is {formatCurrency(record.totalCost, record.currencyCode)}. Once a record has line items,
      its cost is worked out from them.
    </p>
  ) : null;

  if (!plan.fields.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          Nothing to add. This record already has everything the {noun} shows.
        </p>
        {leftOut}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {plan.fields.map((field) => (
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]" key={field}>
            <dt className="text-sm text-slate-500">{FIELD_LABELS[field]}</dt>
            <dd className="min-w-0 break-words text-sm font-medium text-slate-950">
              {describeChange(field, plan.changes, record)}
            </dd>
          </div>
        ))}
      </dl>
      {leftOut}
    </div>
  );
}

function describeChange(
  field: MaintenanceFillField,
  changes: MaintenanceFillPlan['changes'],
  record: MaintenanceRecord,
): ReactNode {
  switch (field) {
    case 'category':
      return changes.category ? formatMaintenanceCategory(changes.category) : null;
    case 'workshopName':
      return changes.workshopName;
    case 'invoiceNumber':
      return changes.invoiceNumber;
    case 'notes':
      return <span className="line-clamp-3">{changes.notes}</span>;
    case 'lineItems': {
      const lineItems = changes.lineItems ?? [];
      return (
        <>
          {lineItems.length} item{lineItems.length === 1 ? '' : 's'}, adding up to{' '}
          {formatCurrency(record.totalCost, record.currencyCode)}
          <span className="mt-0.5 line-clamp-2 block font-normal text-slate-500">
            {lineItems.map((lineItem) => lineItem.name).join(', ')}
          </span>
        </>
      );
    }
    case 'nextDueDate':
      return changes.nextDueDate ? formatDate(changes.nextDueDate) : null;
    case 'nextDueOdometer':
      return changes.nextDueOdometer !== undefined
        ? `${changes.nextDueOdometer.toLocaleString('en-IN')} km`
        : null;
  }
}

function Progress({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-4 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {children}
    </p>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      role="alert"
    >
      {children}
    </p>
  );
}

/** "a", "a and b", "a, b and c". */
function listOf(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join('');
}
