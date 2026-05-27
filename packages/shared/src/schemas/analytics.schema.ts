import { z } from 'zod';

export const CostSplitQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const decimalString = z.string().regex(/^\d+(\.\d+)?$/);

export const CostSplitBucketSchema = z.object({
  fuel: decimalString,
  maintenance: decimalString,
  insurance: decimalString,
  total: decimalString,
});

export const CostSplitResponseSchema = z.object({
  currency: z.literal('INR'),
  range: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  buckets: CostSplitBucketSchema,
  vehicleId: z.string().uuid().optional(),
});
