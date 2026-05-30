import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  type MaintenanceInvoiceExtractionDraft,
} from '@vehicle-vault/shared';

import type {
  ExtractionContext,
  ExtractionFile,
  ExtractionSpec,
} from '../../extraction/types';

type RawLineItem = {
  kind?: string;
  name?: string;
  normalizedCategory?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  brand?: string;
  partNumber?: string;
  notes?: string;
};

type RawMaintenanceInvoice = {
  confidence?: number;
  vendorName?: string;
  workshopName?: string;
  invoiceNumber?: string;
  documentDate?: string;
  serviceDate?: string;
  odometer?: number;
  totalCost?: number;
  currencyCode?: string;
  notes?: string;
  lineItems?: RawLineItem[];
};

const maintenanceCategories = Object.values(MaintenanceCategory);
const maintenanceLineItemKinds = Object.values(MaintenanceLineItemKind);

@Injectable()
export class MaintenanceInvoiceExtractionSpec
  implements ExtractionSpec<MaintenanceInvoiceExtractionDraft>
{
  readonly kind = 'maintenance_invoice' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any = {
    description: 'Maintenance invoice or job card extraction',
    type: SchemaType.OBJECT,
    properties: {
      confidence: {
        type: SchemaType.NUMBER,
        description: 'Confidence score between 0 and 1',
      },
      vendorName: {
        type: SchemaType.STRING,
        description: 'Business or vendor name from the document',
      },
      workshopName: {
        type: SchemaType.STRING,
        description: 'Workshop or service center name if visible',
      },
      invoiceNumber: {
        type: SchemaType.STRING,
        description: 'Invoice number, bill number, or job card number',
      },
      documentDate: {
        type: SchemaType.STRING,
        description: 'Document date in ISO 8601 format if available',
      },
      serviceDate: {
        type: SchemaType.STRING,
        description:
          'Service completion date in ISO 8601 format if distinct from document date',
      },
      odometer: {
        type: SchemaType.INTEGER,
        description: 'Vehicle odometer reading as an integer if present',
      },
      totalCost: {
        type: SchemaType.NUMBER,
        description: 'Grand total amount payable',
      },
      currencyCode: {
        type: SchemaType.STRING,
        description: 'Three-letter ISO currency code when inferable',
      },
      notes: {
        type: SchemaType.STRING,
        description: 'Short notes that summarize the work done',
      },
      lineItems: {
        type: SchemaType.ARRAY,
        description: 'Structured line items found in the document',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            kind: {
              type: SchemaType.STRING,
              description: `One of: ${maintenanceLineItemKinds.join(', ')}`,
            },
            name: {
              type: SchemaType.STRING,
              description: 'Human-readable line item name',
            },
            normalizedCategory: {
              type: SchemaType.STRING,
              description: `One of: ${maintenanceCategories.join(', ')}`,
            },
            quantity: { type: SchemaType.NUMBER },
            unit: { type: SchemaType.STRING },
            unitPrice: { type: SchemaType.NUMBER },
            lineTotal: { type: SchemaType.NUMBER },
            brand: { type: SchemaType.STRING },
            partNumber: { type: SchemaType.STRING },
            notes: { type: SchemaType.STRING },
          },
        },
      },
    },
  };

  buildPrompt(files: ExtractionFile[], _context?: ExtractionContext): string {
    return [
      files.length > 1
        ? `Extract one merged maintenance record from these ${files.length} invoice, receipt, or workshop job card pages.`
        : 'Extract structured maintenance data from this invoice, receipt, or workshop job card.',
      'Return only JSON that matches the provided schema.',
      'Treat multiple files as pages of the same document in the order provided.',
      'Merge header fields, totals, taxes, and line items into one coherent result.',
      'Use the best matching line item kind from this set:',
      maintenanceLineItemKinds.join(', '),
      'Use the best matching normalizedCategory from this set when obvious:',
      maintenanceCategories.join(', '),
      'If a field is not present, omit it.',
      'Keep line items concise and only include actual maintenance-related entries.',
    ].join(' ');
  }

  normalize(raw: unknown): MaintenanceInvoiceExtractionDraft {
    const r = (raw ?? {}) as RawMaintenanceInvoice;
    const lineItems = r.lineItems?.reduce<
      NonNullable<MaintenanceInvoiceExtractionDraft['lineItems']>
    >((acc, item) => {
      const normalized = normalizeLineItem(item);
      if (normalized) acc.push(normalized);
      return acc;
    }, []);

    return {
      confidence: normalizeConfidence(r.confidence),
      vendorName: normalizeString(r.vendorName),
      workshopName: normalizeString(r.workshopName),
      invoiceNumber: normalizeString(r.invoiceNumber),
      documentDate: normalizeDate(r.documentDate),
      serviceDate: normalizeDate(r.serviceDate),
      odometer: normalizeInteger(r.odometer),
      totalCost: normalizeNumber(r.totalCost),
      currencyCode: normalizeCurrency(r.currencyCode),
      notes: normalizeString(r.notes),
      lineItems: lineItems?.length ? lineItems : undefined,
    };
  }
}

function normalizeLineItem(
  raw: RawLineItem,
): NonNullable<MaintenanceInvoiceExtractionDraft['lineItems']>[number] | null {
  const name = normalizeString(raw.name);
  const kind = normalizeLineItemKind(raw.kind);
  if (!name || !kind) return null;
  return {
    kind,
    name,
    normalizedCategory: normalizeCategory(raw.normalizedCategory),
    quantity: normalizeNumber(raw.quantity),
    unit: normalizeString(raw.unit),
    unitPrice: normalizeNumber(raw.unitPrice),
    lineTotal: normalizeNumber(raw.lineTotal),
    brand: normalizeString(raw.brand),
    partNumber: normalizeString(raw.partNumber),
    notes: normalizeString(raw.notes),
  };
}

function normalizeConfidence(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

function normalizeCurrency(value: string | undefined) {
  const normalized = normalizeString(value)?.toUpperCase();
  if (!normalized || normalized.length !== 3) return undefined;
  return normalized;
}

function normalizeDate(value: string | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeInteger(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.round(value);
}

function normalizeNumber(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Number(value);
}

function normalizeString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeCategory(value: string | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  return maintenanceCategories.find((category) => category === normalized);
}

function normalizeLineItemKind(value: string | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  return maintenanceLineItemKinds.find((kind) => kind === normalized);
}
