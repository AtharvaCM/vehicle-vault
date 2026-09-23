import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  isPublicCatalogSegment,
  PUBLIC_CATALOG_MODEL_PAGE_BATCH_MAX,
  PUBLIC_CATALOG_VARIANT_PAGE_BATCH_MAX,
} from '@vehicle-vault/shared';

import { Public } from '../../common/auth/decorators/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { ModelPageBatchQueryDto } from './dto/model-page-batch-query.dto';
import { VariantPageBatchQueryDto } from './dto/variant-page-batch-query.dto';
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

  @Get('index')
  @RateLimit('catalog')
  @Header('Cache-Control', PUBLIC_CATALOG_CACHE_CONTROL)
  @ApiOperation({ summary: 'Every publishable variant, for the build-time prerender' })
  async getIndex() {
    return successResponse(await this.publicCatalogService.getIndex());
  }

  @Get('variant-pages')
  @RateLimit('catalog')
  @Header('Cache-Control', PUBLIC_CATALOG_CACHE_CONTROL)
  @ApiOperation({ summary: 'Variant page payloads in bulk, a page at a time, in index order' })
  async getVariantPageBatch(@Query() query: VariantPageBatchQueryDto) {
    return successResponse(
      await this.publicCatalogService.getVariantPageBatch({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? PUBLIC_CATALOG_VARIANT_PAGE_BATCH_MAX,
      }),
    );
  }

  @Get('model-pages')
  @RateLimit('catalog')
  @Header('Cache-Control', PUBLIC_CATALOG_CACHE_CONTROL)
  @ApiOperation({ summary: 'Model page payloads in bulk, a page at a time, by address' })
  async getModelPageBatch(@Query() query: ModelPageBatchQueryDto) {
    return successResponse(
      await this.publicCatalogService.getModelPageBatch({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? PUBLIC_CATALOG_MODEL_PAGE_BATCH_MAX,
      }),
    );
  }

  @Get(':segment/:make/:model')
  @RateLimit('catalog')
  @Header('Cache-Control', PUBLIC_CATALOG_CACHE_CONTROL)
  @ApiOperation({
    summary: 'A catalog model, its variants by generation, as its public page shows it',
  })
  async getModelPage(
    @Param('segment') segment: string,
    @Param('make') make: string,
    @Param('model') model: string,
  ) {
    if (!isPublicCatalogSegment(segment)) {
      throw new NotFoundException('No public catalog page at this address.');
    }

    return successResponse(await this.publicCatalogService.getModelPage({ segment, make, model }));
  }

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
