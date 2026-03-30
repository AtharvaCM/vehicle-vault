import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { successResponse } from '../../common/utils/api-response.util';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleIdParamDto } from './dto/vehicle-id-param.dto';

import { VehicleInsightsService } from './vehicle-insights.service';
import { MaintenanceForecastService } from './maintenance-forecast.service';
import { VehiclesService } from './vehicles.service';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly vehicleInsightsService: VehicleInsightsService,
    private readonly maintenanceForecastService: MaintenanceForecastService,
  ) {}

  @Get(':vehicleId/insights')
  @ApiOperation({ summary: 'Get odometer insights for a vehicle' })
  async getVehicleInsights(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return this.vehicleInsightsService.getOdometerInsights(user.id, params.vehicleId);
  }

  @Get(':vehicleId/forecast')
  @ApiOperation({ summary: 'Get maintenance forecast suggestions' })
  async getVehicleForecast(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return this.maintenanceForecastService.getUpcomingSuggestions(user.id, params.vehicleId);
  }

  @Get()
  @ApiOperation({ summary: 'List all vehicles' })
  async listVehicles(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    const result = await this.vehiclesService.listVehicles(user.id, query);

    return successResponse(result.data, result.meta);
  }

  @Get(':vehicleId')
  @ApiOperation({ summary: 'Get vehicle details by ID' })
  async getVehicleById(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return this.vehiclesService.getVehicleById(user.id, params.vehicleId);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new vehicle' })
  async createVehicle(@CurrentUser() user: AuthUser, @Body() body: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(user.id, body);
  }

  @Patch(':vehicleId')
  @ApiOperation({ summary: 'Update vehicle details' })
  async updateVehicle(
    @CurrentUser() user: AuthUser,
    @Param() params: VehicleIdParamDto,
    @Body() body: UpdateVehicleDto,
  ) {
    return this.vehiclesService.updateVehicle(user.id, params.vehicleId, body);
  }

  @Delete(':vehicleId')
  @ApiOperation({ summary: 'Unregister/Delete a vehicle' })
  async deleteVehicle(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return successResponse(await this.vehiclesService.deleteVehicle(user.id, params.vehicleId));
  }
}
