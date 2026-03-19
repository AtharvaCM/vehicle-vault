import type { z } from 'zod';

import { AttachmentSchema } from '../schemas';

export type Attachment = z.infer<typeof AttachmentSchema>;
export type CreateAttachmentResponse = Attachment[];
