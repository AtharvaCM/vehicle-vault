import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { isPublicCatalogSegment } from '@vehicle-vault/shared';

import { Public } from '../../common/auth/decorators/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { PublicCatalogService } from './public-catalog.service';

/**
 * Cacheable by browsers and any CDN in front: the catalog changes only when an
 * import run is published, and a page an hour stale is fine.
 */
export const PUBLIC_CATALOG_CACHE_CONTROL = 'public, max-age=3600';

/**
 * The catalog as strangers see it, with no sign-in. Kept apart from the
 * authenticated `vehicle-catalog` controller, which serves the pickers and the
 * import-review screens, so nothing on that side becomes public by accident.
 */
@ApiTags('Public Catalog')
@Public()
@Controller('public-catalog')
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get(':segment/:make/:model/:generation/:variant')
  @RateLimit('catalog')
  @Header('Cache-Control', PUBLIC_CATALOG_CACHE_CONTROL)
  @ApiOperation({ summary: 'A catalog variant as its public page shows it' })
  async getVariantPage(
    @Param('segment') segment: string,
    @Param('make') make: string,
    @Param('model') model: string,
    @Param('generation') generation: string,
    @Param('variant') variant: string,
  ) {
    if (!isPublicCatalogSegment(segment)) {
      throw new NotFoundException('No public catalog page at this address.');
    }

    return successResponse(
      await this.publicCatalogService.getVariantPage({
        segment,
        make,
        model,
        generation,
        variant,
      }),
    );
  }
}
