import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import type { ClaimExtractionSuggestion } from '@vehicle-vault/shared';

import type {
  ExtractionContext,
  ExtractionFile,
  ExtractionSpec,
} from '../../extraction/types';

type RawClaimExtraction = {
  confidence?: number;
  claimNumber?: string;
  grossAmount?: number;
  insurerPaidAmount?: number;
  filedDate?: string;
  settledDate?: string;
  vendorName?: string;
  notes?: string;
};

@Injectable()
export class ClaimDocumentExtractionSpec
  implements ExtractionSpec<ClaimExtractionSuggestion>
{
  readonly kind = 'claim_document' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any = {
    description:
      'Insurance-claim extraction from receipts, surveyor reports, or settlement letters',
    type: SchemaType.OBJECT,
    properties: {
      confidence: {
        type: SchemaType.NUMBER,
        description: 'Confidence score between 0 and 1',
      },
      claimNumber: {
        type: SchemaType.STRING,
        description:
          'Insurer claim reference number if visible (often labelled Claim #, Claim No, CL/...)',
      },
      grossAmount: {
        type: SchemaType.NUMBER,
        description: 'Full repair bill total before insurance contribution',
      },
      insurerPaidAmount: {
        type: SchemaType.NUMBER,
        description:
          'Amount paid by the insurance company. If the document only shows a customer share or excess, derive insurer paid = gross - customer share.',
      },
      filedDate: {
        type: SchemaType.STRING,
        description:
          'Date the claim was filed (ISO 8601). Often the document or intimation date.',
      },
      settledDate: {
        type: SchemaType.STRING,
        description:
          'Date the claim was settled / paid out (ISO 8601). Only if explicitly stated.',
      },
      vendorName: {
        type: SchemaType.STRING,
        description: 'Body shop / garage / workshop name on the receipt',
      },
      notes: {
        type: SchemaType.STRING,
        description: 'Brief summary of damage or scope of repair',
      },
    },
  };

  buildPrompt(_files: ExtractionFile[], _context?: ExtractionContext): string {
    return [
      'Extract structured insurance-claim data from this body-shop receipt,',
      'surveyor report, claim settlement letter, or insurer SMS screenshot.',
      'Return only JSON matching the provided schema.',
      'If the document shows only a customer share or excess, derive insurer paid = gross - customer share.',
      'Use ISO 8601 for any date field.',
      'Omit fields that are not present.',
    ].join(' ');
  }

  normalize(raw: unknown): ClaimExtractionSuggestion {
    const r = (raw ?? {}) as RawClaimExtraction;
    const grossAmount = normalizeNonNegativeNumber(r.grossAmount);
    let insurerPaidAmount = normalizeNonNegativeNumber(r.insurerPaidAmount);

    // Defensive: if model reports insurer paid > gross, clamp to gross.
    if (
      typeof grossAmount === 'number' &&
      typeof insurerPaidAmount === 'number' &&
      insurerPaidAmount > grossAmount
    ) {
      insurerPaidAmount = grossAmount;
    }

    return {
      confidence: normalizeConfidence(r.confidence),
      claimNumber: normalizeString(r.claimNumber),
      grossAmount,
      insurerPaidAmount,
      filedDate: normalizeDate(r.filedDate),
      settledDate: normalizeDate(r.settledDate),
      vendorName: normalizeString(r.vendorName),
      notes: normalizeString(r.notes),
    };
  }
}

function normalizeConfidence(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

function normalizeNonNegativeNumber(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return undefined;
  return Number(value);
}

function normalizeDate(value: string | undefined) {
  const trimmed = normalizeString(value);
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
