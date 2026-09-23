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
  /** Accessories are their own bucket so they never distort the maintenance figure. */
  accessories: decimalString,
  insurance: decimalString,
  loanInterest: decimalString,
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
  accessories: decimalString,
  insurance: decimalString,
  loanInterest: decimalString,
  loanPrincipal: decimalString,
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

/**
 * The least distance ₹/km is worth dividing by. Below it, a year's insurance or
 * a single service spread over a few hundred kilometres reads as a running
 * cost several times the real one, so the card asks for the purchase odometer
 * instead of showing a number.
 */
export const TCO_MIN_COST_PER_KM_DISTANCE_KM = 1_000;

export const TcoResponseSchema = z.object({
  currency: z.literal('INR'),
  vehicleId: z.string().uuid(),
  purchaseDate: z.string().datetime().nullable(),
  purchasePrice: decimalString.nullable(),
  purchaseOdometer: z.number().int().nonnegative().nullable(),
  ownershipMonths: z.number().nonnegative().nullable(),
  kmSincePurchase: z.number().nonnegative(),
  totals: z.object({
    maintenance: decimalString,
    fuel: decimalString,
    accessories: decimalString,
    insurance: decimalString,
    insurerReimbursed: decimalString,
    loanInterest: decimalString,
    loanPrincipalPaid: decimalString,
    loanOutstanding: decimalString,
    netSpend: decimalString,
    tco: decimalString.nullable(),
  }),
  derived: z.object({
    costPerKm: decimalString.nullable(),
    costPerMonth: decimalString.nullable(),
  }),
});
