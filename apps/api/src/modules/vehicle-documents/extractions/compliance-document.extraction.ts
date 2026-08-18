import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import type { ComplianceExtractionDraft } from '@vehicle-vault/shared';

import type { ExtractionContext, ExtractionFile, ExtractionSpec } from '../../extraction/types';
import {
  normalizeDate,
  normalizeNonNegativeNumber,
  normalizeString,
  vehicleContextHint,
} from './extraction-normalizers';

type RawComplianceExtraction = {
  confidence?: number;
  provider?: string;
  number?: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
  notes?: string;
};

/**
 * Per-kind guidance appended to the prompt. `documentKind` arrives in the
 * extraction context from the controller, so one spec serves all three
 * compliance kinds without three near-identical prompts drifting apart.
 */
const KIND_GUIDANCE: Record<string, string> = {
  registration:
    'This is a Registration Certificate (RC). provider is the issuing RTO (e.g. "RTO Pune (MH-12)"). number is the registration number printed on the card. startDate is the date of registration; endDate is the registration validity end — for private vehicles this is typically 15 years from registration, and when the card shows no expiry at all, omit endDate.',
  puc: 'This is a Pollution Under Control (PUC) certificate. provider is the testing centre. number is the PUC certificate serial. startDate is the test date, endDate the valid-until date — usually 6 or 12 months later. amount is the test fee when printed.',
  road_tax:
    'This is a road tax / motor vehicle tax receipt. provider is the collecting authority (RTO or state transport department). number is the receipt or challan number. amount is the tax paid. startDate is the payment date. Lifetime (one-time) tax has no expiry — omit endDate in that case rather than inventing one.',
};

@Injectable()
export class ComplianceDocumentExtractionSpec
  implements ExtractionSpec<ComplianceExtractionDraft>
{
  readonly kind = 'compliance_document' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any = {
    description: 'Indian vehicle compliance document extraction (RC, PUC, road tax)',
    type: SchemaType.OBJECT,
    properties: {
      confidence: { type: SchemaType.NUMBER, description: 'Confidence score between 0 and 1' },
      provider: {
        type: SchemaType.STRING,
        description:
          'Issuing authority — RTO, testing centre, or state transport department. Include the RTO code when printed, e.g. "RTO Pune (MH-12)".',
      },
      number: {
        type: SchemaType.STRING,
        description:
          'Document number exactly as printed: RC number, PUC certificate serial, or tax receipt / challan number.',
      },
      startDate: {
        type: SchemaType.STRING,
        description:
          'Issue, test, or payment date in ISO 8601 (YYYY-MM-DD) — when the document became effective.',
      },
      endDate: {
        type: SchemaType.STRING,
        description:
          'Validity end in ISO 8601 (YYYY-MM-DD). Omit entirely for lifetime / one-time documents that never expire.',
      },
      amount: {
        type: SchemaType.NUMBER,
        description:
          'Amount paid in INR as a plain number. Strip ₹, Rs., INR and thousands separators.',
      },
      notes: {
        type: SchemaType.STRING,
        description: 'Anything material that does not fit the fields above.',
      },
    },
    required: [],
  };

  buildPrompt(files: ExtractionFile[], context?: ExtractionContext): string {
    const documentKind = typeof context?.documentKind === 'string' ? context.documentKind : '';

    const lines = [
      files.length > 1
        ? `Extract one compliance document from these ${files.length} pages.`
        : 'Extract structured data from this Indian vehicle compliance document.',
      'Return only JSON matching the provided schema.',
      'Use ISO 8601 (YYYY-MM-DD) for all dates. Strip any time-of-day component.',
      'Strip currency symbols (₹, Rs., INR) and thousands separators from amount. Read Indian digit grouping correctly: 1,00,000 is one hundred thousand.',
      KIND_GUIDANCE[documentKind] ??
        'Identify whether this is a registration certificate, PUC certificate, or road tax receipt, and populate the fields accordingly.',
      'Omit fields that are not present. Never invent an expiry date for a document that does not state one.',
    ];

    const hint = vehicleContextHint(context);
    if (hint) {
      lines.push(
        `Vehicle context: ${hint}. If the document covers multiple vehicles, pick the entry matching these hints.`,
      );
    }

    return lines.join(' ');
  }

  normalize(raw: unknown): ComplianceExtractionDraft {
    const r = (raw ?? {}) as RawComplianceExtraction;

    return {
      provider: normalizeString(r.provider),
      number: normalizeString(r.number),
      startDate: normalizeDate(r.startDate),
      endDate: normalizeDate(r.endDate),
      amount: normalizeNonNegativeNumber(r.amount),
      notes: normalizeString(r.notes),
    };
  }
}
