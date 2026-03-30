import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
  type CreateMaintenanceLineItemInput,
} from '@vehicle-vault/shared';

import type { CreateMaintenanceRecordBody } from '../types/maintenance-record';
import { getMaintenanceLineItemBreakdown } from './get-maintenance-line-item-breakdown';

export const maintenanceImportFieldDefinitions = [
  {
    id: 'serviceDate',
    label: 'Service date',
    description: 'Completed service date',
    required: true,
    section: 'record',
    synonyms: ['service date', 'date', 'service_date', 'job date'],
  },
  {
    id: 'odometer',
    label: 'Odometer',
    description: 'Mileage at service time',
    required: true,
    section: 'record',
    synonyms: ['odometer', 'km', 'kms', 'mileage'],
  },
  {
    id: 'category',
    label: 'Category',
    description: 'Mapped maintenance category',
    required: false,
    section: 'record',
    synonyms: ['category', 'service type', 'maintenance type'],
  },
  {
    id: 'workshopName',
    label: 'Workshop',
    description: 'Garage or service center',
    required: false,
    section: 'record',
    synonyms: ['workshop', 'garage', 'service center', 'vendor', 'dealer'],
  },
  {
    id: 'invoiceNumber',
    label: 'Invoice number',
    description: 'Invoice or job card number',
    required: false,
    section: 'record',
    synonyms: ['invoice', 'invoice number', 'job card', 'bill number', 'receipt number'],
  },
  {
    id: 'recordKey',
    label: 'Group key',
    description: 'Use this to group multiple CSV rows into one maintenance record',
    required: false,
    section: 'record',
    synonyms: ['group key', 'record key', 'external key', 'job id'],
  },
  {
    id: 'currencyCode',
    label: 'Currency',
    description: 'Three-letter currency code',
    required: false,
    section: 'record',
    synonyms: ['currency', 'currency code'],
  },
  {
    id: 'totalCost',
    label: 'Total cost',
    description: 'Grand total for the visit',
    required: false,
    section: 'record',
    synonyms: ['total', 'total cost', 'amount', 'grand total', 'paid amount'],
  },
  {
    id: 'laborCost',
    label: 'Labor cost',
    description: 'Explicit labor total',
    required: false,
    section: 'record',
    synonyms: ['labor', 'labour', 'labor cost', 'labour cost'],
  },
  {
    id: 'partsCost',
    label: 'Parts cost',
    description: 'Explicit parts total',
    required: false,
    section: 'record',
    synonyms: ['parts', 'parts cost'],
  },
  {
    id: 'fluidsCost',
    label: 'Fluids cost',
    description: 'Explicit fluids total',
    required: false,
    section: 'record',
    synonyms: ['fluids', 'fluids cost', 'oil cost', 'coolant cost'],
  },
  {
    id: 'taxCost',
    label: 'Tax',
    description: 'Tax amount',
    required: false,
    section: 'record',
    synonyms: ['tax', 'gst', 'vat'],
  },
  {
    id: 'discountAmount',
    label: 'Discount',
    description: 'Discount applied',
    required: false,
    section: 'record',
    synonyms: ['discount', 'rebate'],
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Free-form visit notes',
    required: false,
    section: 'record',
    synonyms: ['notes', 'remarks', 'description'],
  },
  {
    id: 'nextDueDate',
    label: 'Next due date',
    description: 'Follow-up service date',
    required: false,
    section: 'record',
    synonyms: ['next due date', 'next service date'],
  },
  {
    id: 'nextDueOdometer',
    label: 'Next due odometer',
    description: 'Follow-up service mileage',
    required: false,
    section: 'record',
    synonyms: ['next due odometer', 'next service km', 'next due km'],
  },
  {
    id: 'source',
    label: 'Source',
    description: 'manual, csv, ocr, or api',
    required: false,
    section: 'record',
    synonyms: ['source'],
  },
  {
    id: 'status',
    label: 'Status',
    description: 'draft or confirmed',
    required: false,
    section: 'record',
    synonyms: ['status'],
  },
  {
    id: 'itemKind',
    label: 'Item kind',
    description: 'job, part, fluid, labor, fee, tax, discount, or other',
    required: false,
    section: 'item',
    synonyms: ['item kind', 'line type', 'item type'],
  },
  {
    id: 'itemName',
    label: 'Item name',
    description: 'Line item title',
    required: false,
    section: 'item',
    synonyms: ['item name', 'part name', 'line item', 'job name'],
  },
  {
    id: 'itemCategory',
    label: 'Item category',
    description: 'Mapped maintenance category for the item',
    required: false,
    section: 'item',
    synonyms: ['item category', 'part category'],
  },
  {
    id: 'itemQuantity',
    label: 'Item quantity',
    description: 'Item quantity',
    required: false,
    section: 'item',
    synonyms: ['quantity', 'qty', 'item quantity'],
  },
  {
    id: 'itemUnit',
    label: 'Item unit',
    description: 'L, pcs, hrs, etc.',
    required: false,
    section: 'item',
    synonyms: ['unit', 'uom', 'item unit'],
  },
  {
    id: 'itemUnitPrice',
    label: 'Item unit price',
    description: 'Price per unit',
    required: false,
    section: 'item',
    synonyms: ['unit price', 'rate', 'item rate'],
  },
  {
    id: 'itemLineTotal',
    label: 'Item total',
    description: 'Line item amount',
    required: false,
    section: 'item',
    synonyms: ['line total', 'item total', 'line amount'],
  },
  {
    id: 'itemBrand',
    label: 'Item brand',
    description: 'Brand for the part or fluid',
    required: false,
    section: 'item',
    synonyms: ['brand', 'item brand'],
  },
  {
    id: 'itemPartNumber',
    label: 'Part number',
    description: 'Part or SKU number',
    required: false,
    section: 'item',
    synonyms: ['part number', 'sku'],
  },
  {
    id: 'itemNotes',
    label: 'Item notes',
    description: 'Notes for the line item',
    required: false,
    section: 'item',
    synonyms: ['item notes', 'line notes'],
  },
] as const;

export type MaintenanceImportFieldId = (typeof maintenanceImportFieldDefinitions)[number]['id'];
export type MaintenanceImportMapping = Partial<Record<MaintenanceImportFieldId, string>>;
export type MaintenanceImportIssue = {
  rowNumber: number;
  message: string;
};

export type MaintenanceImportPreview = {
  issues: MaintenanceImportIssue[];
  records: CreateMaintenanceRecordBody[];
};

type CsvRow = Record<string, unknown>;

type DraftMaintenanceRecord = {
  category?: MaintenanceCategory;
  currencyCode?: string;
  discountAmount?: number;
  fluidsCost?: number;
  invoiceNumber?: string;
  laborCost?: number;
  lineItems: CreateMaintenanceLineItemInput[];
  nextDueDate?: string;
  nextDueOdometer?: number;
  notes?: string;
  odometer: number;
  partsCost?: number;
  serviceDate: string;
  source?: MaintenanceSource;
  status?: MaintenanceRecordStatus;
  taxCost?: number;
  totalCost?: number;
  workshopName?: string;
};

export function createSuggestedMaintenanceImportMapping(headers: string[]) {
  const mapping: MaintenanceImportMapping = {};

  maintenanceImportFieldDefinitions.forEach((field) => {
    const match = headers.find((header) => headerMatchesField(header, field.synonyms));

    if (match) {
      mapping[field.id] = match;
    }
  });

  const hasLineItemSignals = Boolean(
    mapping.itemName ||
      mapping.itemKind ||
      mapping.itemCategory ||
      mapping.itemQuantity ||
      mapping.itemUnitPrice,
  );

  if (hasLineItemSignals) {
    const itemAmountHeader = headers.find((header) =>
      headerMatchesField(header, ['amount', 'line total', 'item total', 'line amount']),
    );
    const explicitGrandTotalHeader = headers.find((header) =>
      headerMatchesField(header, ['grand total', 'total cost', 'paid amount']),
    );

    if (itemAmountHeader) {
      mapping.itemLineTotal = itemAmountHeader;

      if (
        mapping.totalCost === itemAmountHeader &&
        (!explicitGrandTotalHeader || explicitGrandTotalHeader === itemAmountHeader)
      ) {
        delete mapping.totalCost;
      }
    }

    if (!mapping.totalCost && explicitGrandTotalHeader) {
      mapping.totalCost = explicitGrandTotalHeader;
    }
  }

  return mapping;
}

export function parseMaintenanceImportRows(
  rows: CsvRow[],
  mapping: MaintenanceImportMapping,
): MaintenanceImportPreview {
  const groupedRecords = new Map<string, DraftMaintenanceRecord>();
  const issues: MaintenanceImportIssue[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const serviceDate = parseDate(readMappedString(row, mapping.serviceDate));
    const odometer = parseInteger(readMappedString(row, mapping.odometer));

    if (!serviceDate) {
      issues.push({
        rowNumber,
        message: 'Service date is required and must be a valid date.',
      });
      return;
    }

    if (odometer === undefined) {
      issues.push({
        rowNumber,
        message: 'Odometer is required and must be numeric.',
      });
      return;
    }

    const invoiceNumber = readMappedString(row, mapping.invoiceNumber);
    const workshopName = readMappedString(row, mapping.workshopName);
    const recordGroupKey =
      readMappedString(row, mapping.recordKey) ||
      invoiceNumber ||
      `${serviceDate}|${odometer}|${workshopName || ''}|${index}`;

    const currentRecord =
      groupedRecords.get(recordGroupKey) ??
      ({
        lineItems: [],
        odometer,
        serviceDate,
      } satisfies DraftMaintenanceRecord);

    currentRecord.serviceDate = currentRecord.serviceDate ?? serviceDate;
    currentRecord.odometer = currentRecord.odometer ?? odometer;
    currentRecord.category =
      currentRecord.category ||
      normalizeMaintenanceCategory(readMappedString(row, mapping.category));
    currentRecord.workshopName = currentRecord.workshopName || workshopName;
    currentRecord.invoiceNumber = currentRecord.invoiceNumber || invoiceNumber;
    currentRecord.currencyCode =
      currentRecord.currencyCode ||
      normalizeCurrencyCode(readMappedString(row, mapping.currencyCode));
    currentRecord.totalCost =
      currentRecord.totalCost ?? parseNumber(readMappedString(row, mapping.totalCost));
    currentRecord.laborCost =
      currentRecord.laborCost ?? parseNumber(readMappedString(row, mapping.laborCost));
    currentRecord.partsCost =
      currentRecord.partsCost ?? parseNumber(readMappedString(row, mapping.partsCost));
    currentRecord.fluidsCost =
      currentRecord.fluidsCost ?? parseNumber(readMappedString(row, mapping.fluidsCost));
    currentRecord.taxCost =
      currentRecord.taxCost ?? parseNumber(readMappedString(row, mapping.taxCost));
    currentRecord.discountAmount =
      currentRecord.discountAmount ?? parseNumber(readMappedString(row, mapping.discountAmount));
    currentRecord.notes = appendUniqueNote(
      currentRecord.notes,
      readMappedString(row, mapping.notes),
    );
    currentRecord.nextDueDate =
      currentRecord.nextDueDate || parseDate(readMappedString(row, mapping.nextDueDate));
    currentRecord.nextDueOdometer =
      currentRecord.nextDueOdometer ?? parseInteger(readMappedString(row, mapping.nextDueOdometer));
    currentRecord.source =
      currentRecord.source || normalizeSource(readMappedString(row, mapping.source));
    currentRecord.status =
      currentRecord.status || normalizeStatus(readMappedString(row, mapping.status));

    const lineItem = createImportedLineItem(row, mapping);

    if (lineItem) {
      currentRecord.lineItems.push({
        ...lineItem,
        position: currentRecord.lineItems.length,
      });
    }

    groupedRecords.set(recordGroupKey, currentRecord);
  });

  const records = Array.from(groupedRecords.values()).map((record) => {
    const derivedBreakdown = getMaintenanceLineItemBreakdown(record.lineItems);
    const category =
      record.category ||
      record.lineItems.find((lineItem) => lineItem.normalizedCategory)?.normalizedCategory ||
      MaintenanceCategory.Other;

    return {
      serviceDate: record.serviceDate,
      odometer: record.odometer,
      category,
      workshopName: record.workshopName,
      invoiceNumber: record.invoiceNumber,
      currencyCode: record.currencyCode || 'INR',
      source: record.source || MaintenanceSource.Csv,
      status: record.status || MaintenanceRecordStatus.Confirmed,
      totalCost: record.totalCost ?? derivedBreakdown.totalCost,
      laborCost:
        record.laborCost ?? (record.lineItems.length ? derivedBreakdown.laborCost : undefined),
      partsCost:
        record.partsCost ?? (record.lineItems.length ? derivedBreakdown.partsCost : undefined),
      fluidsCost:
        record.fluidsCost ?? (record.lineItems.length ? derivedBreakdown.fluidsCost : undefined),
      taxCost: record.taxCost ?? (record.lineItems.length ? derivedBreakdown.taxCost : undefined),
      discountAmount:
        record.discountAmount ??
        (record.lineItems.length ? derivedBreakdown.discountAmount : undefined),
      notes: record.notes,
      nextDueDate: record.nextDueDate,
      nextDueOdometer: record.nextDueOdometer,
      lineItems: record.lineItems.length ? record.lineItems : undefined,
    } satisfies CreateMaintenanceRecordBody;
  });

  return {
    issues,
    records,
  };
}

function createImportedLineItem(
  row: CsvRow,
  mapping: MaintenanceImportMapping,
): CreateMaintenanceLineItemInput | null {
  const name = readMappedString(row, mapping.itemName);
  const normalizedCategory = normalizeMaintenanceCategory(
    readMappedString(row, mapping.itemCategory),
  );
  const quantity = parseNumber(readMappedString(row, mapping.itemQuantity));
  const unitPrice = parseNumber(readMappedString(row, mapping.itemUnitPrice));
  const lineTotal = parseNumber(readMappedString(row, mapping.itemLineTotal));
  const unit = readMappedString(row, mapping.itemUnit);
  const brand = readMappedString(row, mapping.itemBrand);
  const partNumber = readMappedString(row, mapping.itemPartNumber);
  const notes = readMappedString(row, mapping.itemNotes);
  const kind =
    normalizeLineItemKind(readMappedString(row, mapping.itemKind)) ||
    inferLineItemKind(normalizedCategory);

  const hasMeaningfulData = Boolean(
    name ||
    normalizedCategory ||
    typeof quantity === 'number' ||
    typeof unitPrice === 'number' ||
    typeof lineTotal === 'number' ||
    unit ||
    brand ||
    partNumber ||
    notes,
  );

  if (!hasMeaningfulData) {
    return null;
  }

  return {
    kind,
    name: name || formatFallbackLineItemName(kind, normalizedCategory),
    normalizedCategory,
    quantity,
    unit,
    unitPrice,
    lineTotal,
    brand,
    partNumber,
    notes,
  };
}

function appendUniqueNote(existing: string | undefined, next: string | undefined) {
  if (!next) {
    return existing;
  }

  if (!existing) {
    return next;
  }

  return existing.includes(next) ? existing : `${existing}\n${next}`;
}

function formatFallbackLineItemName(
  kind: MaintenanceLineItemKind,
  normalizedCategory?: MaintenanceCategory,
) {
  if (normalizedCategory) {
    return normalizedCategory
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function headerMatchesField(header: string, synonyms: readonly string[]) {
  const normalizedHeader = normalizeToken(header);

  return synonyms.some((synonym) => normalizedHeader.includes(normalizeToken(synonym)));
}

function inferLineItemKind(normalizedCategory?: MaintenanceCategory) {
  if (
    normalizedCategory === MaintenanceCategory.EngineOil ||
    normalizedCategory === MaintenanceCategory.Coolant
  ) {
    return MaintenanceLineItemKind.Fluid;
  }

  if (
    normalizedCategory &&
    [
      MaintenanceCategory.OilFilter,
      MaintenanceCategory.AirFilter,
      MaintenanceCategory.BrakePads,
      MaintenanceCategory.Battery,
      MaintenanceCategory.Clutch,
      MaintenanceCategory.TyreReplacement,
    ].includes(normalizedCategory)
  ) {
    return MaintenanceLineItemKind.Part;
  }

  return MaintenanceLineItemKind.Job;
}

function normalizeCurrencyCode(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();

  return normalized && normalized.length === 3 ? normalized : undefined;
}

function normalizeLineItemKind(value: string | undefined) {
  const normalized = normalizeToken(value);

  return Object.values(MaintenanceLineItemKind).find(
    (candidate) => normalizeToken(candidate) === normalized,
  );
}

function normalizeMaintenanceCategory(value: string | undefined) {
  const normalized = normalizeToken(value);

  return Object.values(MaintenanceCategory).find(
    (candidate) => normalizeToken(candidate) === normalized,
  );
}

function normalizeSource(value: string | undefined) {
  const normalized = normalizeToken(value);

  return Object.values(MaintenanceSource).find(
    (candidate) => normalizeToken(candidate) === normalized,
  );
}

function normalizeStatus(value: string | undefined) {
  const normalized = normalizeToken(value);

  return Object.values(MaintenanceRecordStatus).find(
    (candidate) => normalizeToken(candidate) === normalized,
  );
}

function normalizeToken(value: string | undefined) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parseInteger(value: string | undefined) {
  const parsed = parseNumber(value);

  return typeof parsed === 'number' ? Math.round(parsed) : undefined;
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/[^0-9.\-]/g, '');
  const parsed = Number.parseFloat(normalized);

  return Number.isNaN(parsed) ? undefined : parsed;
}

function readMappedString(row: CsvRow, header: string | undefined) {
  if (!header) {
    return undefined;
  }

  const value = row[header];

  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();

  return normalized ? normalized : undefined;
}
