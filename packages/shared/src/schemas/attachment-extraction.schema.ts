import { z } from 'zod';

import { AttachmentExtractionStatus, MaintenanceCategory, MaintenanceLineItemKind } from '../enums';

const isoDateTimeString = z.string().datetime({ offset: true });

export const AttachmentExtractionLineItemSchema = z.object({
  kind: z.nativeEnum(MaintenanceLineItemKind),
  name: z.string().trim().min(1).max(160),
  normalizedCategory: z.nativeEnum(MaintenanceCategory).optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().trim().max(24).optional(),
  unitPrice: z.number().nonnegative().optional(),
  lineTotal: z.number().nonnegative().optional(),
  brand: z.string().trim().max(80).optional(),
  partNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const AttachmentExtractionSchema = z.object({
  id: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
  status: z.nativeEnum(AttachmentExtractionStatus),
  provider: z.string().trim().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  vendorName: z.string().trim().min(1).optional(),
  workshopName: z.string().trim().min(1).optional(),
  invoiceNumber: z.string().trim().min(1).optional(),
  documentDate: isoDateTimeString.optional(),
  serviceDate: isoDateTimeString.optional(),
  odometer: z.number().int().nonnegative().optional(),
  totalCost: z.number().nonnegative().optional(),
  currencyCode: z.string().trim().length(3).optional(),
  notes: z.string().trim().min(1).optional(),
  lineItems: z.array(AttachmentExtractionLineItemSchema).optional(),
  failureReason: z.string().trim().min(1).optional(),
  extractedAt: isoDateTimeString.optional(),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});

export const AttachmentExtractionStatusSchema = z.object({
  available: z.boolean(),
});
