import { z } from 'zod';

import { AttachmentKind } from '../enums';

const isoDateTimeString = z.string().datetime({ offset: true });

/**
 * Read shape for an attachment that belongs to an insurance Claim
 * (receipts, surveyor reports, photos of damage). Mirrors the
 * maintenance-owned AttachmentSchema but swaps the owner FK to claimId.
 */
export const ClaimAttachmentSchema = z.object({
  id: z.string().trim().min(1),
  claimId: z.string().trim().min(1),
  kind: z.nativeEnum(AttachmentKind),
  fileName: z.string().trim().min(1),
  originalFileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  size: z.number().int().nonnegative(),
  url: z.string().trim().min(1),
  uploadedAt: isoDateTimeString,
});

export type ClaimAttachment = z.infer<typeof ClaimAttachmentSchema>;

/**
 * Ephemeral OCR-extracted suggestion for a claim, parsed from an uploaded
 * receipt / settlement letter / surveyor report. Never persisted —
 * returned by the extraction endpoint, displayed to the user, and then
 * applied to the underlying Claim via the standard update endpoint.
 *
 * All fields optional; the model returns whatever it can recognise.
 */
export const ClaimExtractionSuggestionSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  claimNumber: z.string().max(120).optional(),
  grossAmount: z.number().nonnegative().optional(),
  insurerPaidAmount: z.number().nonnegative().optional(),
  filedDate: z.string().datetime({ offset: true }).optional(),
  settledDate: z.string().datetime({ offset: true }).optional(),
  vendorName: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export type ClaimExtractionSuggestion = z.infer<typeof ClaimExtractionSuggestionSchema>;
