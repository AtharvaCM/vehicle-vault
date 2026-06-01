import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import type { LoanDocumentExtractionDraft } from '@vehicle-vault/shared';

import type {
  ExtractionContext,
  ExtractionFile,
  ExtractionSpec,
} from '../../extraction/types';

type RawLoanDocument = {
  confidence?: number;
  lender?: string;
  accountNumber?: string;
  principal?: number;
  interestRate?: number;
  tenureMonths?: number;
  startDate?: string;
  emiAmount?: number;
  currencyCode?: string;
  notes?: string;
};

@Injectable()
export class LoanDocumentExtractionSpec
  implements ExtractionSpec<LoanDocumentExtractionDraft>
{
  readonly kind = 'loan_document' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any = {
    description: 'Vehicle loan document extraction (sanction letter, agreement, schedule).',
    type: SchemaType.OBJECT,
    properties: {
      confidence: {
        type: SchemaType.NUMBER,
        description: 'Confidence score between 0 and 1.',
      },
      lender: {
        type: SchemaType.STRING,
        description: 'Name of the lending bank / NBFC (e.g. HDFC Bank, Bajaj Finance).',
      },
      accountNumber: {
        type: SchemaType.STRING,
        description: 'Loan / agreement account number.',
      },
      principal: {
        type: SchemaType.NUMBER,
        description: 'Principal loan amount sanctioned (in the loan currency, no symbols).',
      },
      interestRate: {
        type: SchemaType.NUMBER,
        description:
          'Annual nominal interest rate as a percent (e.g. 8.75 for 8.75% per year). Always per-annum.',
      },
      tenureMonths: {
        type: SchemaType.INTEGER,
        description:
          'Total loan tenure in months. Convert years (e.g. 7y -> 84) before returning.',
      },
      startDate: {
        type: SchemaType.STRING,
        description:
          'Loan start / disbursement / first-EMI date as ISO 8601 (YYYY-MM-DD or full datetime).',
      },
      emiAmount: {
        type: SchemaType.NUMBER,
        description: 'Equated monthly instalment amount in the loan currency.',
      },
      currencyCode: {
        type: SchemaType.STRING,
        description: 'ISO 4217 currency code (default INR for Indian loans).',
      },
      notes: {
        type: SchemaType.STRING,
        description:
          'Salient terms (benchmark, spread, processing fee, prepayment charges) in one short paragraph.',
      },
    },
    required: [],
  };

  buildPrompt(_files: ExtractionFile[], _context?: ExtractionContext): string {
    return [
      'Extract vehicle-loan terms from this document (sanction letter, loan agreement, or repayment schedule).',
      'Look for: lender name, loan / agreement / account number, principal sanctioned, interest rate per annum (%), tenure (convert to months), disbursement or first-EMI date, EMI amount, currency.',
      'Return numbers without currency symbols or commas. Interest rate is per-annum percent (e.g. 8.75).',
      'If a field is unclear or absent, omit it. Return valid JSON.',
    ].join(' ');
  }

  normalize(raw: unknown): LoanDocumentExtractionDraft {
    const r = (raw ?? {}) as RawLoanDocument;
    return {
      confidence: clampUnit(r.confidence),
      lender: normalizeString(r.lender, 120),
      accountNumber: normalizeString(r.accountNumber, 80),
      principal: positiveNumber(r.principal),
      interestRate: clampPercent(r.interestRate),
      tenureMonths: positiveInteger(r.tenureMonths, 600),
      startDate: normalizeDate(r.startDate),
      emiAmount: positiveNumber(r.emiAmount),
      currencyCode: normalizeCurrency(r.currencyCode),
      notes: normalizeString(r.notes, 500),
    };
  }
}

function normalizeString(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function positiveNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return undefined;
  return Number(value);
}

function positiveInteger(value: number | undefined, max: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return undefined;
  const int = Math.round(value);
  if (int > max) return undefined;
  return int;
}

function clampUnit(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampPercent(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return undefined;
  if (value > 100) return undefined;
  return value;
}

function normalizeCurrency(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed || trimmed.length !== 3) return undefined;
  return trimmed;
}

function normalizeDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  // Accept YYYY-MM-DD or full ISO; normalize bare date to UTC midnight ISO.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const iso = dateOnly ? `${trimmed}T00:00:00.000Z` : trimmed;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
