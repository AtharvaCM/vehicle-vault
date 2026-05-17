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
