import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import type { FuelReceiptExtractionDraft } from '@vehicle-vault/shared';

import type {
  ExtractionContext,
  ExtractionFile,
  ExtractionSpec,
} from '../../extraction/types';

type RawFuelReceipt = {
  confidence?: number;
  date?: string;
  quantity?: number;
  price?: number;
  totalCost?: number;
  location?: string;
};

@Injectable()
export class FuelReceiptExtractionSpec
  implements ExtractionSpec<FuelReceiptExtractionDraft>
{
  readonly kind = 'fuel_receipt' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any = {
    description: 'Fuel receipt data extraction',
    type: SchemaType.OBJECT,
    properties: {
      confidence: {
        type: SchemaType.NUMBER,
        description: 'Confidence score between 0 and 1',
      },
      date: {
        type: SchemaType.STRING,
        description: 'ISO 8601 date string of the transaction',
      },
      quantity: {
        type: SchemaType.NUMBER,
        description: 'Number of litres filled',
      },
      price: {
        type: SchemaType.NUMBER,
        description: 'Price per litre',
      },
      totalCost: {
        type: SchemaType.NUMBER,
        description: 'Total amount paid',
      },
      location: {
        type: SchemaType.STRING,
        description: 'Name of the gas station',
      },
    },
    required: ['totalCost'],
  };

  buildPrompt(_files: ExtractionFile[], _context?: ExtractionContext): string {
    return 'Extract fuel receipt data from this image. If a field is not found, omit it. Return valid JSON.';
  }

  normalize(raw: unknown): FuelReceiptExtractionDraft {
    const r = (raw ?? {}) as RawFuelReceipt;
    return {
      date: normalizeString(r.date),
      quantity: normalizeNonNegativeNumber(r.quantity),
      price: normalizeNonNegativeNumber(r.price),
      totalCost: normalizeNonNegativeNumber(r.totalCost),
      location: normalizeString(r.location),
    };
  }
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNonNegativeNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return undefined;
  return Number(value);
}
