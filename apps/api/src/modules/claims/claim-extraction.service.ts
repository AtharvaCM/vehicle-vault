import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ClaimExtractionSuggestion } from '@vehicle-vault/shared';

import { AppConfigService } from '../../config/app-config.service';

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
export class ClaimExtractionService {
  private genAI: GoogleGenerativeAI | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;

  constructor(private readonly config: AppConfigService) {
    const apiKey = this.config.geminiApiKey;
    if (!apiKey) return;

    this.genAI = new GoogleGenerativeAI(apiKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: any = {
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

    this.model = this.genAI.getGenerativeModel({
      model: this.config.geminiModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  }

  get isAvailable(): boolean {
    return Boolean(this.model);
  }

  async extractFromDocument(file: Buffer, mimeType: string): Promise<ClaimExtractionSuggestion> {
    if (!this.model) {
      throw new InternalServerErrorException('OCR service is not configured (missing API key)');
    }

    try {
      const prompt = [
        'Extract structured insurance-claim data from this body-shop receipt,',
        'surveyor report, claim settlement letter, or insurer SMS screenshot.',
        'Return only JSON matching the provided schema.',
        'If the document shows only a customer share or excess, derive insurer paid = gross - customer share.',
        'Use ISO 8601 for any date field.',
        'Omit fields that are not present.',
      ].join(' ');

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: file.toString('base64'),
            mimeType,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();
      const raw = JSON.parse(text) as RawClaimExtraction;

      return this.normalize(raw);
    } catch (error) {
      console.error('Claim attachment OCR error:', error);
      throw new InternalServerErrorException('Failed to process claim document with AI.');
    }
  }

  private normalize(raw: RawClaimExtraction): ClaimExtractionSuggestion {
    const grossAmount = this.normalizeNonNegativeNumber(raw.grossAmount);
    let insurerPaidAmount = this.normalizeNonNegativeNumber(raw.insurerPaidAmount);

    // Defensive: if model reports insurer paid > gross, clamp to gross.
    if (
      typeof grossAmount === 'number' &&
      typeof insurerPaidAmount === 'number' &&
      insurerPaidAmount > grossAmount
    ) {
      insurerPaidAmount = grossAmount;
    }

    return {
      confidence: this.normalizeConfidence(raw.confidence),
      claimNumber: this.normalizeString(raw.claimNumber),
      grossAmount,
      insurerPaidAmount,
      filedDate: this.normalizeDate(raw.filedDate),
      settledDate: this.normalizeDate(raw.settledDate),
      vendorName: this.normalizeString(raw.vendorName),
      notes: this.normalizeString(raw.notes),
    };
  }

  private normalizeConfidence(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
    return Math.min(1, Math.max(0, value));
  }

  private normalizeNonNegativeNumber(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return undefined;
    return Number(value);
  }

  private normalizeDate(value: string | undefined) {
    const trimmed = this.normalizeString(value);
    if (!trimmed) return undefined;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private normalizeString(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
