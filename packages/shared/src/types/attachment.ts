import type { z } from 'zod';

import {
  AttachmentExtractionSchema,
  AttachmentExtractionStatusSchema,
  AttachmentReconciliationSummarySchema,
  AttachmentSchema,
} from '../schemas';

export type Attachment = z.infer<typeof AttachmentSchema>;
export type AttachmentExtraction = z.infer<typeof AttachmentExtractionSchema>;
export type AttachmentExtractionStatusResponse = z.infer<typeof AttachmentExtractionStatusSchema>;
export type CreateAttachmentResponse = Attachment[];
export type AttachmentReconciliationSummary = z.infer<typeof AttachmentReconciliationSummarySchema>;
