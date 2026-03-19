import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { successResponse } from '../../common/utils/api-response.util';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
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
  createVehicle(@Body() body: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(body);
  }

  @Patch(':vehicleId')
  updateVehicle(@Param() params: VehicleIdParamDto, @Body() body: UpdateVehicleDto) {
    return this.vehiclesService.updateVehicle(params.vehicleId, body);
  }

  @Delete(':vehicleId')
  deleteVehicle(@Param() params: VehicleIdParamDto) {
    return successResponse(this.vehiclesService.deleteVehicle(params.vehicleId));
  }
}
