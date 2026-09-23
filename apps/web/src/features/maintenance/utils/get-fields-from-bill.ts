import type { Attachment, AttachmentExtraction } from '@/features/attachments/types/attachment';
import { toDateInputValue } from '@/lib/utils/to-date-input-value';

import type { MaintenanceFormValues } from '../schemas/maintenance-form.schema';
import { getMaintenanceLineItemBreakdown } from './get-maintenance-line-item-breakdown';

/** The form fields a bill can fill, each of which can carry a "from bill" marker. */
export type BillField = Extract<
  keyof MaintenanceFormValues,
  | 'serviceDate'
  | 'odometer'
  | 'category'
  | 'workshopName'
  | 'invoiceNumber'
  | 'currencyCode'
  | 'totalCost'
  | 'notes'
  | 'nextDueDate'
  | 'nextDueOdometer'
>;

type BillValues = Partial<Record<BillField, string | number>>;

/**
 * What applying an extraction writes into a draft, field by field. It mirrors
 * the API's `buildMaintenanceUpdateFromExtraction`: the document date stands in
 * for a missing service date, the vendor for a missing workshop, the items'
 * total for a missing total, and the first categorised item names the category.
 */
export function getBillValues(extraction: AttachmentExtraction): BillValues {
  const lineItems = extraction.lineItems ?? [];
  const serviceDate = extraction.serviceDate ?? extraction.documentDate;
  const values: BillValues = {
    serviceDate: serviceDate ? toDateInputValue(serviceDate) : undefined,
    odometer: extraction.odometer,
    category: lineItems.find((lineItem) => lineItem.normalizedCategory)?.normalizedCategory,
    workshopName: extraction.workshopName ?? extraction.vendorName,
    invoiceNumber: extraction.invoiceNumber,
    currencyCode: extraction.currencyCode,
    totalCost:
      extraction.totalCost ??
      (lineItems.length ? getMaintenanceLineItemBreakdown(lineItems).totalCost : undefined),
    notes: extraction.notes,
    nextDueDate: extraction.nextDueDate ? toDateInputValue(extraction.nextDueDate) : undefined,
    nextDueOdometer: extraction.nextDueOdometer,
  };

  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== ''),
  ) as BillValues;
}

/** Whether the bill was read into anything the draft could take. */
export function hasBillValues(extraction: AttachmentExtraction) {
  return Object.keys(getBillValues(extraction)).length > 0 || Boolean(extraction.lineItems?.length);
}

/**
 * The draft's fields that still hold what the bill says: the ones its "from
 * bill" markers belong to. Derived from the saved values rather than remembered
 * from the upload, so a reload keeps the markers and a field someone changed and
 * saved loses its own.
 */
export function getFieldsFromBill(
  extraction: AttachmentExtraction,
  values: Partial<MaintenanceFormValues>,
): Set<BillField> {
  const fields = new Set<BillField>();

  for (const [field, billValue] of Object.entries(getBillValues(extraction))) {
    if (values[field as BillField] === billValue) {
      fields.add(field as BillField);
    }
  }

  return fields;
}

/**
 * The extraction the draft was filled from: the latest completed read among its
 * files. A multi-page read stores the same merged result on every page.
 */
export function pickBillExtraction(attachments: Attachment[]) {
  let latest: AttachmentExtraction | undefined;

  for (const attachment of attachments) {
    const extraction = attachment.extraction;

    if (extraction?.status !== 'completed') {
      continue;
    }

    if (!latest || extraction.updatedAt > latest.updatedAt) {
      latest = extraction;
    }
  }

  return latest;
}
