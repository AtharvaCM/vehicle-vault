import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { CatalogImportRunIdParamDto } from './dto/catalog-import-run-id-param.dto';
import { ListVehicleCatalogMakesDto } from './dto/list-vehicle-catalog-makes.dto';
import { ListVehicleCatalogModelsDto } from './dto/list-vehicle-catalog-models.dto';
import { ListVehicleCatalogVariantsDto } from './dto/list-vehicle-catalog-variants.dto';
import { VehicleCatalogService } from './vehicle-catalog.service';

@Controller('vehicle-catalog')
export class VehicleCatalogController {
  constructor(private readonly vehicleCatalogService: VehicleCatalogService) {}

  @Get('makes')
  async listMakes(@Query() query: ListVehicleCatalogMakesDto) {
    return successResponse(await this.vehicleCatalogService.listMakes(query));
  }

  @Get('models')
  async listModels(@Query() query: ListVehicleCatalogModelsDto) {
    return successResponse(await this.vehicleCatalogService.listModels(query));
  }

  @Get('variants')
  async listVariants(@Query() query: ListVehicleCatalogVariantsDto) {
    return successResponse(await this.vehicleCatalogService.listVariants(query));
  }

  @Get('import-runs')
  async listImportRuns() {
    return successResponse(await this.vehicleCatalogService.listImportRuns());
  }

  @Get('import-runs/:runId')
  async getImportRunDetail(@Param() params: CatalogImportRunIdParamDto) {
    return successResponse(await this.vehicleCatalogService.getImportRunDetail(params.runId));
  }

  @Post('import-runs/:runId/publish')
  async publishImportRun(
    @Param() params: CatalogImportRunIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(await this.vehicleCatalogService.publishImportRun(user.id, params.runId));
  }
}
