import type { z } from 'zod';

import {
  CostSplitBucketSchema,
  CostSplitQuerySchema,
  CostSplitResponseSchema,
} from '../schemas/analytics.schema';

export type CostSplitQuery = z.infer<typeof CostSplitQuerySchema>;
export type CostSplitBucket = z.infer<typeof CostSplitBucketSchema>;
export type CostSplitResponse = z.infer<typeof CostSplitResponseSchema>;
