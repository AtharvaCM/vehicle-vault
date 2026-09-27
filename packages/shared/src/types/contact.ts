import type { z } from 'zod';

import { ContactMessageInputSchema, ContactMessageSchema } from '../schemas';

export type ContactMessageInput = z.infer<typeof ContactMessageInputSchema>;
export type ContactMessage = z.infer<typeof ContactMessageSchema>;
