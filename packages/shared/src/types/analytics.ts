import type { z } from 'zod';

import {
  CostSplitBucketSchema,
  CostSplitQuerySchema,
  CostSplitResponseSchema,
  CostTrendPointSchema,
  CostTrendQuerySchema,
  CostTrendResponseSchema,
  TcoResponseSchema,
} from '../schemas/analytics.schema';

export type CostSplitQuery = z.infer<typeof CostSplitQuerySchema>;
export type CostSplitBucket = z.infer<typeof CostSplitBucketSchema>;
export type CostSplitResponse = z.infer<typeof CostSplitResponseSchema>;

export type CostTrendQuery = z.infer<typeof CostTrendQuerySchema>;
export type CostTrendPoint = z.infer<typeof CostTrendPointSchema>;
export type CostTrendResponse = z.infer<typeof CostTrendResponseSchema>;

export type TcoResponse = z.infer<typeof TcoResponseSchema>;
