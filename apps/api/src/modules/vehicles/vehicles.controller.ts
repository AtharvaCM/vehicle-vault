import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
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
  async listVehicles(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    const result = await this.vehiclesService.listVehicles(user.id, query);

    return successResponse(result.data, result.meta);
  }

  @Get(':vehicleId')
  async getVehicleById(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return this.vehiclesService.getVehicleById(user.id, params.vehicleId);
  }

  @Post()
  async createVehicle(@CurrentUser() user: AuthUser, @Body() body: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(user.id, body);
  }

  @Patch(':vehicleId')
  async updateVehicle(
    @CurrentUser() user: AuthUser,
    @Param() params: VehicleIdParamDto,
    @Body() body: UpdateVehicleDto,
  ) {
    return this.vehiclesService.updateVehicle(user.id, params.vehicleId, body);
  }

  @Delete(':vehicleId')
  async deleteVehicle(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return successResponse(await this.vehiclesService.deleteVehicle(user.id, params.vehicleId));
  }
}
