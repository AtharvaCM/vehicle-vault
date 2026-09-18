import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { RateLimitGuard } from './rate-limit.guard';
import { RATE_LIMIT_BUCKET, type RateLimitBucket } from './rate-limit.types';

/** Limit this route per client IP under the bucket's policy. */
export const RateLimit = (bucket: RateLimitBucket) =>
  applyDecorators(SetMetadata(RATE_LIMIT_BUCKET, bucket), UseGuards(RateLimitGuard));
