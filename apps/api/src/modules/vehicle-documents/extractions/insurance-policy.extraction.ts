import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import type { InsurancePolicyExtractionDraft } from '@vehicle-vault/shared';

import type {
  ExtractionContext,
  ExtractionFile,
  ExtractionSpec,
} from '../../extraction/types';

type RawInsuranceExtraction = {
  confidence?: number;
  provider?: string;
  policyNumber?: string;
  startDate?: string;
  endDate?: string;
  premiumAmount?: number;
  insuredValue?: number;
  notes?: string;
};

@Injectable()
export class InsurancePolicyExtractionSpec
  implements ExtractionSpec<InsurancePolicyExtractionDraft>
{
  readonly kind = 'insurance_policy' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any = {
    description: 'Vehicle insurance policy extraction',
    type: SchemaType.OBJECT,
    properties: {
      confidence: {
        type: SchemaType.NUMBER,
        description: 'Confidence score between 0 and 1',
      },
      provider: {
        type: SchemaType.STRING,
        description:
          'Insurer / insurance company name (e.g. "HDFC ERGO", "ICICI Lombard"). Free text.',
      },
      policyNumber: {
        type: SchemaType.STRING,
        description:
          'Policy number exactly as printed. Often labelled Policy No., Cert. No., or appears near the insurer logo.',
      },
      startDate: {
        type: SchemaType.STRING,
        description:
          'Policy period start in ISO 8601 (YYYY-MM-DD). Also called "From", "Period of Insurance From".',
      },
      endDate: {
        type: SchemaType.STRING,
        description:
          'Policy period end in ISO 8601 (YYYY-MM-DD). Also called "To", "Expiry", "Valid Upto".',
      },
      premiumAmount: {
        type: SchemaType.NUMBER,
        description:
          'Total premium paid (gross premium including GST). Strip currency symbols and thousands separators. Return the number only.',
      },
      insuredValue: {
        type: SchemaType.NUMBER,
        description:
          'Insured Declared Value (IDV) for own-damage cover. Strip currency symbols. Omit on third-party-only policies.',
      },
      notes: {
        type: SchemaType.STRING,
        description: 'Short summary of cover type (Comprehensive, Third-Party, OD only, etc.).',
      },
    },
  };

  buildPrompt(files: ExtractionFile[], context?: ExtractionContext): string {
    const lines = [
      files.length > 1
        ? `Extract one insurance policy from these ${files.length} pages.`
        : 'Extract structured insurance-policy data from this document.',
      'Source may be a policy schedule PDF, certificate of insurance, cover note, or a photo of either.',
      'Return only JSON matching the provided schema.',
      'Use ISO 8601 (YYYY-MM-DD) for all dates.',
      'Strip currency symbols (₹, Rs., INR, $) and thousands separators from numeric fields.',
      'Omit fields that are not present.',
    ];

    if (context && Object.keys(context).length > 0) {
      const hints = Object.entries(context)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(', ');
      if (hints) {
        lines.push(
          `Vehicle context: ${hints}. If the document covers multiple vehicles, pick the policy entry matching these hints.`,
        );
      }
    }

    return lines.join(' ');
  }

  normalize(raw: unknown): InsurancePolicyExtractionDraft {
    const r = (raw ?? {}) as RawInsuranceExtraction;
    return {
      provider: normalizeString(r.provider),
      policyNumber: normalizeString(r.policyNumber),
      startDate: normalizeDate(r.startDate),
      endDate: normalizeDate(r.endDate),
      premiumAmount: normalizeNonNegativeNumber(r.premiumAmount),
      insuredValue: normalizeNonNegativeNumber(r.insuredValue),
      notes: normalizeString(r.notes),
    };
  }
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDate(value: string | undefined): string | undefined {
  const trimmed = normalizeString(value);
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeNonNegativeNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return undefined;
  return Number(value);
}
