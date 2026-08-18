import { Injectable } from '@nestjs/common';
import { SchemaType } from '@google/generative-ai';
import type { WarrantyExtractionDraft } from '@vehicle-vault/shared';

import type { ExtractionContext, ExtractionFile, ExtractionSpec } from '../../extraction/types';
import {
  normalizeDate,
  normalizeNonNegativeInteger,
  normalizeString,
  vehicleContextHint,
} from './extraction-normalizers';

type RawWarrantyExtraction = {
  confidence?: number;
  provider?: string;
  warrantyNumber?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  endOdometer?: number;
  notes?: string;
};

const WARRANTY_TYPES = ['Manufacturer', 'Extended', 'Parts'] as const;

@Injectable()
export class WarrantyDocumentExtractionSpec implements ExtractionSpec<WarrantyExtractionDraft> {
  readonly kind = 'warranty_document' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly responseSchema: any = {
    description: 'Vehicle warranty document extraction',
    type: SchemaType.OBJECT,
    properties: {
      confidence: { type: SchemaType.NUMBER, description: 'Confidence score between 0 and 1' },
      provider: {
        type: SchemaType.STRING,
        description:
          'Manufacturer, dealer, or warranty provider issuing the coverage (e.g. "Hyundai Motor India", "GoMechanic"). Free text.',
      },
      warrantyNumber: {
        type: SchemaType.STRING,
        description:
          'Warranty or certificate number exactly as printed. May be labelled Warranty No., Certificate ID, or Contract No.',
      },
      type: {
        type: SchemaType.STRING,
        description: `Coverage type. One of: ${WARRANTY_TYPES.join(', ')}. "Manufacturer" for standard factory warranty, "Extended" for a purchased extension, "Parts" when only components are covered.`,
      },
      startDate: {
        type: SchemaType.STRING,
        description:
          'Coverage start in ISO 8601 (YYYY-MM-DD). Often the vehicle sale / delivery date on a factory warranty.',
      },
      endDate: {
        type: SchemaType.STRING,
        description:
          'Coverage end in ISO 8601 (YYYY-MM-DD). When only a duration is printed ("3 years"), add it to the start date.',
      },
      endOdometer: {
        type: SchemaType.INTEGER,
        description:
          'Odometer limit in kilometres, as an integer. "1,00,000 km" (Indian grouping) is 100000. Omit when the warranty is time-only.',
      },
      notes: {
        type: SchemaType.STRING,
        description:
          'Anything material that does not fit the fields above — exclusions, covered assemblies, transferability.',
      },
    },
    required: [],
  };

  buildPrompt(files: ExtractionFile[], context?: ExtractionContext): string {
    const lines = [
      files.length > 1
        ? `Extract one warranty from these ${files.length} pages.`
        : 'Extract structured warranty data from this document.',
      'Source may be a warranty booklet page, an extended-warranty contract, a dealer invoice stating coverage, or a photo of any of these.',
      'Return only JSON matching the provided schema.',
      'Use ISO 8601 (YYYY-MM-DD) for all dates. Strip any time-of-day component.',
      `Set type to one of: ${WARRANTY_TYPES.join(', ')}.`,
      'Indian documents often express coverage as "3 years or 1,00,000 km, whichever is earlier". Put the date in endDate and the kilometre figure in endOdometer — both bounds matter, the earlier one wins.',
      'Read Indian digit grouping correctly: 1,00,000 is one hundred thousand, not one hundred.',
      'Omit fields that are not present. Never guess an end date from a start date alone unless the document states the duration.',
    ];

    const hint = vehicleContextHint(context);
    if (hint) {
      lines.push(
        `Vehicle context: ${hint}. If the document covers multiple vehicles, pick the entry matching these hints.`,
      );
    }

    return lines.join(' ');
  }

  normalize(raw: unknown): WarrantyExtractionDraft {
    const r = (raw ?? {}) as RawWarrantyExtraction;
    const type = normalizeString(r.type);

    return {
      provider: normalizeString(r.provider),
      warrantyNumber: normalizeString(r.warrantyNumber),
      // The form's select only accepts the known set; anything else would
      // silently reset to Manufacturer and lose what the model actually read.
      type: WARRANTY_TYPES.find((known) => known.toLowerCase() === type?.toLowerCase()),
      startDate: normalizeDate(r.startDate),
      endDate: normalizeDate(r.endDate),
      endOdometer: normalizeNonNegativeInteger(r.endOdometer),
      notes: normalizeString(r.notes),
    };
  }
}
