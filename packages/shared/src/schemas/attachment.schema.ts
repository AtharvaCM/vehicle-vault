import { z } from 'zod';

import { AttachmentKind } from '../enums';
import { AttachmentExtractionSchema } from './attachment-extraction.schema';

const isoDateTimeString = z.string().datetime({ offset: true });

export const AttachmentSchema = z.object({
  id: z.string().trim().min(1),
  maintenanceRecordId: z.string().trim().min(1),
  kind: z.nativeEnum(AttachmentKind),
  fileName: z.string().trim().min(1),
  originalFileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  size: z.number().int().nonnegative(),
  url: z.string().trim().min(1),
  uploadedAt: isoDateTimeString,
  extraction: AttachmentExtractionSchema.optional(),
});

export const AttachmentReconciliationSummarySchema = z.object({
  checkedCount: z.number().int().nonnegative(),
  healthyCount: z.number().int().nonnegative(),
  removedMissingMetadataCount: z.number().int().nonnegative(),
  removedAttachmentIds: z.array(z.string().trim().min(1)),
});
