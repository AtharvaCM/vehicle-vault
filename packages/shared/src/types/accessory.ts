import type { z } from 'zod';

import type {
  AccessoryCreateSchema,
  AccessorySchema,
  AccessoryUpdateSchema,
} from '../schemas';

export type CreateAccessoryInput = z.infer<typeof AccessoryCreateSchema>;
export type UpdateAccessoryInput = z.infer<typeof AccessoryUpdateSchema>;
export type Accessory = z.infer<typeof AccessorySchema>;

/**
 * How long before a warranty runs out the alert engine starts saying so. Matches
 * the vehicle-document expiry window, so the two read as one behaviour rather
 * than two features that happen to both send warnings.
 */
export const ACCESSORY_WARRANTY_ALERT_WINDOW_DAYS = 7;
