import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  type AttachmentExtraction,
} from '@vehicle-vault/shared';

import { AppConfigService } from '../../config/app-config.service';

type RawExtractionLineItem = {
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

type RawAttachmentExtraction = {
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
  lineItems?: RawExtractionLineItem[];
};

type AttachmentExtractionSuggestion = Omit<
  AttachmentExtraction,
  'attachmentId' | 'createdAt' | 'id' | 'status' | 'updatedAt'
>;

const maintenanceCategories = Object.values(MaintenanceCategory);
const maintenanceLineItemKinds = Object.values(MaintenanceLineItemKind);

@Injectable()
export class AttachmentExtractionService {
  private genAI: GoogleGenerativeAI | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;

  constructor(private readonly config: AppConfigService) {
    const apiKey = this.config.geminiApiKey;

    if (!apiKey) {
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: any = {
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
          description: 'Service completion date in ISO 8601 format if distinct from document date',
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
              quantity: {
                type: SchemaType.NUMBER,
              },
              unit: {
                type: SchemaType.STRING,
              },
              unitPrice: {
                type: SchemaType.NUMBER,
              },
              lineTotal: {
                type: SchemaType.NUMBER,
              },
              brand: {
                type: SchemaType.STRING,
              },
              partNumber: {
                type: SchemaType.STRING,
              },
              notes: {
                type: SchemaType.STRING,
              },
            },
          },
        },
      },
    };

    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  }

  get isAvailable() {
    return Boolean(this.model);
  }

  async extractDocument(file: Buffer, mimeType: string): Promise<AttachmentExtractionSuggestion> {
    if (!this.model) {
      throw new InternalServerErrorException('OCR service is not configured (missing API key)');
    }

    try {
      const prompt = [
        'Extract structured maintenance data from this invoice, receipt, or workshop job card.',
        'Return only JSON that matches the provided schema.',
        'Use the best matching line item kind from this set:',
        maintenanceLineItemKinds.join(', '),
        'Use the best matching normalizedCategory from this set when obvious:',
        maintenanceCategories.join(', '),
        'If a field is not present, omit it.',
        'Keep line items concise and only include actual maintenance-related entries.',
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
      const raw = JSON.parse(text) as RawAttachmentExtraction;

      return this.normalizeExtraction(raw);
    } catch (error) {
      console.error('Maintenance attachment OCR error:', error);
      throw new InternalServerErrorException('Failed to process maintenance document with AI.');
    }
  }

  private normalizeExtraction(raw: RawAttachmentExtraction): AttachmentExtractionSuggestion {
    const lineItems = raw.lineItems?.reduce<
      NonNullable<AttachmentExtractionSuggestion['lineItems']>
    >((accumulator, lineItem) => {
      const normalizedLineItem = this.normalizeLineItem(lineItem);

      if (normalizedLineItem) {
        accumulator.push(normalizedLineItem);
      }

      return accumulator;
    }, []);

    return {
      provider: 'gemini',
      confidence: this.normalizeConfidence(raw.confidence),
      vendorName: this.normalizeString(raw.vendorName),
      workshopName: this.normalizeString(raw.workshopName),
      invoiceNumber: this.normalizeString(raw.invoiceNumber),
      documentDate: this.normalizeDate(raw.documentDate),
      serviceDate: this.normalizeDate(raw.serviceDate),
      odometer: this.normalizeInteger(raw.odometer),
      totalCost: this.normalizeNumber(raw.totalCost),
      currencyCode: this.normalizeCurrency(raw.currencyCode),
      notes: this.normalizeString(raw.notes),
      lineItems: lineItems?.length ? lineItems : undefined,
      extractedAt: new Date().toISOString(),
      failureReason: undefined,
    };
  }

  private normalizeLineItem(raw: RawExtractionLineItem) {
    const name = this.normalizeString(raw.name);
    const kind = this.normalizeLineItemKind(raw.kind);

    if (!name || !kind) {
      return null;
    }

    return {
      kind,
      name,
      normalizedCategory: this.normalizeCategory(raw.normalizedCategory),
      quantity: this.normalizeNumber(raw.quantity),
      unit: this.normalizeString(raw.unit),
      unitPrice: this.normalizeNumber(raw.unitPrice),
      lineTotal: this.normalizeNumber(raw.lineTotal),
      brand: this.normalizeString(raw.brand),
      partNumber: this.normalizeString(raw.partNumber),
      notes: this.normalizeString(raw.notes),
    };
  }

  private normalizeConfidence(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }

    return Math.min(1, Math.max(0, value));
  }

  private normalizeCurrency(value: string | undefined) {
    const normalized = this.normalizeString(value)?.toUpperCase();

    if (!normalized || normalized.length !== 3) {
      return undefined;
    }

    return normalized;
  }

  private normalizeDate(value: string | undefined) {
    const normalized = this.normalizeString(value);

    if (!normalized) {
      return undefined;
    }

    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private normalizeInteger(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }

    return Math.round(value);
  }

  private normalizeNumber(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }

    return Number(value);
  }

  private normalizeString(value: string | undefined) {
    const normalized = value?.trim();

    return normalized ? normalized : undefined;
  }

  private normalizeCategory(value: string | undefined) {
    const normalized = this.normalizeString(value);

    if (!normalized) {
      return undefined;
    }

    return maintenanceCategories.find((category) => category === normalized);
  }

  private normalizeLineItemKind(value: string | undefined) {
    const normalized = this.normalizeString(value);

    if (!normalized) {
      return undefined;
    }

    return maintenanceLineItemKinds.find((kind) => kind === normalized);
  }
}
