import {
  MaintenanceCategory,
  type AttachmentExtraction,
  type MaintenanceFillField,
  type MaintenanceFillPlan,
  type MaintenanceRecord,
  type UpdateMaintenanceRecordInput,
} from '@vehicle-vault/shared';

type ExtractedLineItem = NonNullable<AttachmentExtraction['lineItems']>[number];

export type LineItemBreakdown = {
  totalCost: number;
  laborCost: number;
  partsCost: number;
  fluidsCost: number;
  taxCost: number;
  discountAmount: number;
};

/** As much as a record's notes may hold (MaintenanceRecordCreateSchema). */
const NOTES_MAX_LENGTH = 1000;

const BREAKDOWN_FIELDS = [
  'laborCost',
  'partsCost',
  'fluidsCost',
  'taxCost',
  'discountAmount',
] as const;

/**
 * What "Fill in from photo" writes onto a confirmed record: each field the
 * record still leaves blank, or at the quick log's default category, that the
 * extraction has an answer for. Nothing already on the record is replaced.
 *
 * The date, odometer and cost are never written at all. They are the three
 * things the quick log (#116) asks for, so they are what someone typed. The
 * currency the cost was typed in, the status and the source stay as they are
 * too.
 */
export function planMaintenanceFill(
  record: MaintenanceRecord,
  extraction: AttachmentExtraction,
): MaintenanceFillPlan {
  const fields: MaintenanceFillField[] = [];
  const changes: UpdateMaintenanceRecordInput = {};
  let lineItemsLeftOut: MaintenanceFillPlan['lineItemsLeftOut'];

  // `other` is what a quick log saves until someone says what the work was.
  const category = extraction.lineItems?.find(
    (item) => item.normalizedCategory && item.normalizedCategory !== MaintenanceCategory.Other,
  )?.normalizedCategory;
  if (record.category === MaintenanceCategory.Other && category) {
    changes.category = category;
    fields.push('category');
  }

  const workshopName = extraction.workshopName ?? extraction.vendorName;
  if (!record.workshopName?.trim() && workshopName) {
    changes.workshopName = workshopName;
    fields.push('workshopName');
  }

  if (!record.invoiceNumber?.trim() && extraction.invoiceNumber) {
    changes.invoiceNumber = extraction.invoiceNumber;
    fields.push('invoiceNumber');
  }

  if (!record.notes?.trim() && extraction.notes) {
    changes.notes = truncate(extraction.notes, NOTES_MAX_LENGTH);
    fields.push('notes');
  }

  const lineItems = extraction.lineItems ?? [];
  if (!record.lineItems?.length && lineItems.length) {
    const breakdown = getLineItemBreakdown(lineItems);
    // Once a record has line items, the edit form works its cost out from them
    // (the web's get-maintenance-line-item-breakdown.ts). Line items that add
    // up to anything else would replace the typed cost at the next save.
    if (breakdown.totalCost === roundMoney(record.totalCost)) {
      changes.lineItems = lineItems.map((item, position) => ({ ...item, position }));
      for (const field of BREAKDOWN_FIELDS) {
        if (record[field] === undefined) changes[field] = breakdown[field];
      }
      fields.push('lineItems');
    } else {
      lineItemsLeftOut = { count: lineItems.length, total: breakdown.totalCost };
    }
  }

  // Only a visit after this one. A date or reading at or before this service is
  // this visit's own, misread, and would make a reminder that is already due.
  if (
    !record.nextDueDate &&
    extraction.nextDueDate &&
    Date.parse(extraction.nextDueDate) > Date.parse(record.serviceDate)
  ) {
    changes.nextDueDate = extraction.nextDueDate;
    fields.push('nextDueDate');
  }

  if (
    record.nextDueOdometer == null &&
    extraction.nextDueOdometer != null &&
    extraction.nextDueOdometer > record.odometer
  ) {
    changes.nextDueOdometer = extraction.nextDueOdometer;
    fields.push('nextDueOdometer');
  }

  return { fields, changes, ...(lineItemsLeftOut ? { lineItemsLeftOut } : {}) };
}

/**
 * Line items' cost, split the way a record stores it and rounded to the paisa
 * the way the edit form rounds it. A discount is a magnitude, taken off.
 */
export function getLineItemBreakdown(
  lineItems: ReadonlyArray<
    Pick<ExtractedLineItem, 'kind' | 'quantity' | 'unitPrice' | 'lineTotal'>
  >,
): LineItemBreakdown {
  const totals = lineItems.reduce(
    (sum, lineItem) => {
      const amount =
        typeof lineItem.lineTotal === 'number'
          ? roundMoney(lineItem.lineTotal)
          : typeof lineItem.quantity === 'number' && typeof lineItem.unitPrice === 'number'
            ? roundMoney(lineItem.quantity * lineItem.unitPrice)
            : 0;

      switch (lineItem.kind) {
        case 'labor':
          sum.laborCost += amount;
          sum.totalCost += amount;
          break;
        case 'part':
          sum.partsCost += amount;
          sum.totalCost += amount;
          break;
        case 'fluid':
          sum.fluidsCost += amount;
          sum.totalCost += amount;
          break;
        case 'tax':
          sum.taxCost += amount;
          sum.totalCost += amount;
          break;
        case 'discount':
          sum.discountAmount += amount;
          sum.totalCost -= amount;
          break;
        default:
          sum.totalCost += amount;
          break;
      }

      return sum;
    },
    { totalCost: 0, laborCost: 0, partsCost: 0, fluidsCost: 0, taxCost: 0, discountAmount: 0 },
  );

  return {
    totalCost: roundMoney(totals.totalCost),
    laborCost: roundMoney(totals.laborCost),
    partsCost: roundMoney(totals.partsCost),
    fluidsCost: roundMoney(totals.fluidsCost),
    taxCost: roundMoney(totals.taxCost),
    discountAmount: roundMoney(totals.discountAmount),
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
