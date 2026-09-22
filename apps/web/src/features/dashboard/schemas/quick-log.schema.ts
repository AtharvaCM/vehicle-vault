import { z } from 'zod';

/**
 * The three things known at the workshop counter. Everything else — what was
 * done, where, the line items — can be added to the record later.
 */
export const quickLogSchema = z.object({
  vehicleId: z.string().min(1, 'Choose a vehicle'),
  serviceDate: z.string().trim().min(1, 'Service date is required'),
  odometer: z
    .number({ invalid_type_error: 'Enter the odometer reading' })
    .int('Enter the reading in whole kilometres')
    .nonnegative('Odometer cannot be negative'),
  totalCost: z
    .number({ invalid_type_error: 'Enter what it cost' })
    .nonnegative('Cost cannot be negative'),
});

export type QuickLogValues = z.infer<typeof quickLogSchema>;
