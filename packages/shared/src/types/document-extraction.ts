import { z } from 'zod';

import { AttachmentExtractionLineItemSchema } from '../schemas/attachment-extraction.schema';

/**
 * Discriminator for what shape an extracted JSON payload takes and which
 * target resource the draft hydrates. One kind per use site.
 */
export const ExtractionKindSchema = z.enum([
  'fuel_receipt',
  'maintenance_invoice',
  'insurance_policy',
  'claim_document',
  'loan_document',
]);

export type ExtractionKind = z.infer<typeof ExtractionKindSchema>;

export const ExtractionProviderSchema = z.enum(['gemini']);
export type ExtractionProviderName = z.infer<typeof ExtractionProviderSchema>;

/**
 * Uniform envelope returned by every extraction. The `data` payload is
 * per-kind; `provider`, `extractedAt`, and `confidence` are universal so
 * any extraction is debuggable / auditable without consumer-side branching.
 */
export function ExtractionResultSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    provider: ExtractionProviderSchema,
    extractedAt: z.string().datetime(),
    confidence: z.number().min(0).max(1).optional(),
    data,
  });
}

export type ExtractionResult<T> = {
  provider: ExtractionProviderName;
  extractedAt: string;
  confidence?: number;
  data: T;
};

/**
 * Draft hydrated into the insurance form after a successful scan.
 * Every field is optional — the model may extract some subset; the user
 * always confirms via the form before persistence.
 */
export const InsurancePolicyExtractionDraftSchema = z.object({
  provider: z.string().max(120).optional(),
  policyNumber: z.string().max(80).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  premiumAmount: z.number().min(0).optional(),
  insuredValue: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export type InsurancePolicyExtractionDraft = z.infer<
  typeof InsurancePolicyExtractionDraftSchema
>;

/**
 * Draft hydrated into the fuel-log form after a successful receipt scan.
 * Every field is optional — the model may extract some subset; the user
 * always confirms via the form before persistence.
 */
export const FuelReceiptExtractionDraftSchema = z.object({
  date: z.string().optional(),
  quantity: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  totalCost: z.number().min(0).optional(),
  location: z.string().max(200).optional(),
});

export type FuelReceiptExtractionDraft = z.infer<typeof FuelReceiptExtractionDraftSchema>;

/**
 * Draft hydrated from a maintenance invoice / job-card scan. Persisted
 * into the AttachmentExtraction Prisma row by the attachments module
 * (the only extraction kind today with opt-in persistence).
 */
export const MaintenanceInvoiceExtractionDraftSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  vendorName: z.string().min(1).optional(),
  workshopName: z.string().min(1).optional(),
  invoiceNumber: z.string().min(1).optional(),
  documentDate: z.string().datetime({ offset: true }).optional(),
  serviceDate: z.string().datetime({ offset: true }).optional(),
  odometer: z.number().int().nonnegative().optional(),
  totalCost: z.number().nonnegative().optional(),
  currencyCode: z.string().length(3).optional(),
  notes: z.string().min(1).optional(),
  lineItems: z.array(AttachmentExtractionLineItemSchema).optional(),
});

export type MaintenanceInvoiceExtractionDraft = z.infer<
  typeof MaintenanceInvoiceExtractionDraftSchema
>;

/**
 * Draft hydrated from a vehicle-loan document scan (sanction letter,
 * loan agreement, schedule of charges). Every field optional — the
 * user reviews and confirms via the Add Loan form before persistence.
 */
export const LoanDocumentExtractionDraftSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  lender: z.string().min(1).max(120).optional(),
  accountNumber: z.string().min(1).max(80).optional(),
  principal: z.number().nonnegative().optional(),
  // Annual nominal rate as percent (e.g. 8.75)
  interestRate: z.number().nonnegative().max(100).optional(),
  tenureMonths: z.number().int().positive().max(600).optional(),
  startDate: z.string().datetime().optional(),
  emiAmount: z.number().nonnegative().optional(),
  currencyCode: z.string().length(3).optional(),
  notes: z.string().min(1).max(500).optional(),
});

export type LoanDocumentExtractionDraft = z.infer<typeof LoanDocumentExtractionDraftSchema>;
