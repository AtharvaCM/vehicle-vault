import type { z } from 'zod';

import { AttachmentReconciliationSummarySchema, AttachmentSchema } from '../schemas';

export type Attachment = z.infer<typeof AttachmentSchema>;
export type CreateAttachmentResponse = Attachment[];
export type AttachmentReconciliationSummary = z.infer<
  typeof AttachmentReconciliationSummarySchema
>;
