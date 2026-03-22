import { Controller, Get, Query } from '@nestjs/common';

import { successResponse } from '../../common/utils/api-response.util';
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
}
