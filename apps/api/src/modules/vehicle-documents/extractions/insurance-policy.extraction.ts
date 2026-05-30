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
  // Bundled Indian motor policies usually carry two windows:
  //   - Own Damage (OD): 1-year, optional
  //   - Third-Party (TP): 3-year, mandatory by law
  // We capture both when present, then collapse to the single
  // startDate/endDate that the schema persists.
  ownDamageStartDate?: string;
  ownDamageEndDate?: string;
  thirdPartyStartDate?: string;
  thirdPartyEndDate?: string;
  coverType?: string;
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
          'Single policy period start in ISO 8601 (YYYY-MM-DD). For non-bundled policies. For bundled IN motor policies, use ownDamageStartDate / thirdPartyStartDate instead.',
      },
      endDate: {
        type: SchemaType.STRING,
        description:
          'Single policy period end in ISO 8601 (YYYY-MM-DD). For non-bundled policies. For bundled IN motor policies, use ownDamageEndDate / thirdPartyEndDate instead.',
      },
      ownDamageStartDate: {
        type: SchemaType.STRING,
        description:
          'Own Damage (OD) cover start date in ISO 8601 (YYYY-MM-DD). Indian bundled policies list this in a "Valid From" column next to "Own Damage Cover".',
      },
      ownDamageEndDate: {
        type: SchemaType.STRING,
        description:
          'Own Damage (OD) cover end date in ISO 8601 (YYYY-MM-DD). Listed under "Valid Till" / "Valid Upto" next to "Own Damage Cover". OD is the 1-year renewable component.',
      },
      thirdPartyStartDate: {
        type: SchemaType.STRING,
        description:
          'Third-Party (TP) liability cover start date in ISO 8601 (YYYY-MM-DD). Mandatory by Indian law. In bundled new-car policies the TP term is 3 years.',
      },
      thirdPartyEndDate: {
        type: SchemaType.STRING,
        description:
          'Third-Party (TP) liability cover end date in ISO 8601 (YYYY-MM-DD). Mandatory by Indian law.',
      },
      coverType: {
        type: SchemaType.STRING,
        description:
          'Short tag describing the cover: "Comprehensive", "Third-Party only", "Own Damage only", "Bundled (1yr OD + 3yr TP)", "Standalone OD", etc.',
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
      'Use ISO 8601 (YYYY-MM-DD) for all dates. Strip any time-of-day component.',
      'Strip currency symbols (₹, Rs., INR, $) and thousands separators from numeric fields.',
      'Indian motor policies are often bundled — they list separate "Valid From"/"Valid Till" rows for Own Damage Cover (1-year term) and Third-Party Cover (3-year term). When you see both, populate ownDamageStartDate, ownDamageEndDate, thirdPartyStartDate, thirdPartyEndDate and leave the top-level startDate / endDate empty. When the policy is non-bundled (single-component or comprehensive single-window), populate only startDate / endDate.',
      'Set coverType to a short tag like "Bundled (1yr OD + 3yr TP)", "Comprehensive", "Third-Party only", "Own Damage only", or "Standalone OD" so downstream code can render the right summary.',
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

    const odStart = normalizeDate(r.ownDamageStartDate);
    const odEnd = normalizeDate(r.ownDamageEndDate);
    const tpStart = normalizeDate(r.thirdPartyStartDate);
    const tpEnd = normalizeDate(r.thirdPartyEndDate);
    const flatStart = normalizeDate(r.startDate);
    const flatEnd = normalizeDate(r.endDate);

    // Collapse multi-window bundled policies to the single window the
    // schema persists. Prefer OD window because it drives yearly renewal
    // reminders — TP is mandatory but legally re-issued separately and
    // long enough that single-window expiry alerts would be useless.
    // Fall back: TP window when only TP present, then plain single window.
    const startDate = odStart ?? tpStart ?? flatStart;
    const endDate = odEnd ?? tpEnd ?? flatEnd;

    const notes = composeNotes({
      modelNotes: r.notes,
      coverType: r.coverType,
      odStart,
      odEnd,
      tpStart,
      tpEnd,
      pickedStart: startDate,
      pickedEnd: endDate,
    });

    return {
      provider: normalizeString(r.provider),
      policyNumber: normalizeString(r.policyNumber),
      startDate,
      endDate,
      premiumAmount: normalizeNonNegativeNumber(r.premiumAmount),
      insuredValue: normalizeNonNegativeNumber(r.insuredValue),
      notes,
    };
  }
}

function composeNotes(input: {
  modelNotes: string | undefined;
  coverType: string | undefined;
  odStart: string | undefined;
  odEnd: string | undefined;
  tpStart: string | undefined;
  tpEnd: string | undefined;
  pickedStart: string | undefined;
  pickedEnd: string | undefined;
}): string | undefined {
  const parts: string[] = [];

  const coverType = normalizeString(input.coverType);
  const modelNotes = normalizeString(input.modelNotes);

  if (coverType) parts.push(coverType);
  if (modelNotes && modelNotes.toLowerCase() !== coverType?.toLowerCase()) {
    parts.push(modelNotes);
  }

  // When the policy is bundled, expose both windows in the notes so the
  // user can see what got captured vs. what got dropped by the
  // single-window form. The form pre-fills with the picked window (OD
  // first, then TP); the dropped window survives in notes.
  const hasOd = input.odStart || input.odEnd;
  const hasTp = input.tpStart || input.tpEnd;
  if (hasOd && hasTp) {
    parts.push(
      `OD: ${formatRange(input.odStart, input.odEnd)} | TP: ${formatRange(input.tpStart, input.tpEnd)}`,
    );
  }

  if (!parts.length) return undefined;
  const joined = parts.join('. ');
  return joined.length > 500 ? joined.slice(0, 497) + '…' : joined;
}

function formatRange(start: string | undefined, end: string | undefined): string {
  const s = start ? start.slice(0, 10) : '?';
  const e = end ? end.slice(0, 10) : '?';
  return `${s} → ${e}`;
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
