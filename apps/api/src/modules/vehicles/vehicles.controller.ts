import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { VehicleCreateSchema } from '@vehicle-vault/shared';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ZodSchemaValidationPipe } from '../../common/pipes/zod-schema-validation.pipe';
import { successResponse } from '../../common/utils/api-response.util';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleIdParamDto } from './dto/vehicle-id-param.dto';

import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  listVehicles(@Query() query: PaginationQueryDto) {
    const result = this.vehiclesService.listVehicles(query);

    return successResponse(result.data, result.meta);
  }

  @Get(':vehicleId')
  getVehicleById(@Param() params: VehicleIdParamDto) {
    return this.vehiclesService.getVehicleById(params.vehicleId);
  }

  @Post()
  createVehicle(
    @Body(new ZodSchemaValidationPipe(VehicleCreateSchema))
    body: CreateVehicleDto,
  ) {
    return this.vehiclesService.createVehicle(body);
  }
}
