import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { CatalogOfferingIdParamDto } from './dto/catalog-offering-id-param.dto';
import { CatalogImportRunIdParamDto } from './dto/catalog-import-run-id-param.dto';
import { ListVehicleCatalogMakesDto } from './dto/list-vehicle-catalog-makes.dto';
import { ListVehicleCatalogModelsDto } from './dto/list-vehicle-catalog-models.dto';
import { ListVehicleCatalogVariantsDto } from './dto/list-vehicle-catalog-variants.dto';
import { UpdateVehicleCatalogOfferingReviewDto } from './dto/update-vehicle-catalog-offering-review.dto';
import { VehicleCatalogService } from './vehicle-catalog.service';

@ApiTags('Vehicle Catalog')
@Controller('vehicle-catalog')
export class VehicleCatalogController {
  constructor(private readonly vehicleCatalogService: VehicleCatalogService) {}

  @Get('makes')
  @ApiOperation({ summary: 'List all vehicle makes in the catalog' })
  async listMakes(@Query() query: ListVehicleCatalogMakesDto) {
    return successResponse(await this.vehicleCatalogService.listMakes(query));
  }

  @Get('models')
  @ApiOperation({ summary: 'List all vehicle models for a make' })
  async listModels(@Query() query: ListVehicleCatalogModelsDto) {
    return successResponse(await this.vehicleCatalogService.listModels(query));
  }

  @Get('variants')
  @ApiOperation({ summary: 'List all vehicle variants for a model' })
  async listVariants(@Query() query: ListVehicleCatalogVariantsDto) {
    return successResponse(await this.vehicleCatalogService.listVariants(query));
  }

  @Get('variants/:variantId/specs')
  @ApiOperation({ summary: 'Get detailed technical specifications for a variant' })
  async getVariantSpecs(@Param('variantId') variantId: string) {
    return successResponse(await this.vehicleCatalogService.getVariantSpecs(variantId));
  }

  @Get('specs')
  @ApiOperation({ summary: 'Find variant specifications by make, model, and variant name' })
  async findVariantSpecs(
    @Query('make') make: string,
    @Query('model') model: string,
    @Query('variant') variant: string,
  ) {
    const specs = await this.vehicleCatalogService.findVariantSpecsByName(make, model, variant);
    return successResponse(specs);
  }

  @Get('import-runs')
  @ApiOperation({ summary: 'List recent catalog import runs' })
  async listImportRuns() {
    return successResponse(await this.vehicleCatalogService.listImportRuns());
  }

  @Get('import-runs/:runId')
  @ApiOperation({ summary: 'Get details of a specific import run' })
  async getImportRunDetail(@Param() params: CatalogImportRunIdParamDto) {
    return successResponse(await this.vehicleCatalogService.getImportRunDetail(params.runId));
  }

  @Post('import-runs/:runId/publish')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish an import run to the catalog' })
  async publishImportRun(
    @Param() params: CatalogImportRunIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(await this.vehicleCatalogService.publishImportRun(user, params.runId));
  }

  @Post('import-runs/:runId/archive-missing')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive variants missing from the current import run' })
  async archiveMissingVariants(
    @Param() params: CatalogImportRunIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.vehicleCatalogService.archiveMissingVariants(user, params.runId),
    );
  }

  @Patch('offerings/:offeringId/review')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the review status of a catalog offering' })
  async updateOfferingReview(
    @Param() params: CatalogOfferingIdParamDto,
    @Body() body: UpdateVehicleCatalogOfferingReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.vehicleCatalogService.updateOfferingReview(user, params.offeringId, body),
    );
  }
}
