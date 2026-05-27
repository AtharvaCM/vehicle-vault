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

export const CostTrendQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const CostTrendPointSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  fuel: decimalString,
  maintenance: decimalString,
  insurance: decimalString,
  total: decimalString,
  km: z.number().nonnegative(),
  costPerKm: decimalString.nullable(),
});

export const CostTrendResponseSchema = z.object({
  currency: z.literal('INR'),
  granularity: z.literal('month'),
  range: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  vehicleId: z.string().uuid().optional(),
  points: z.array(CostTrendPointSchema),
});
