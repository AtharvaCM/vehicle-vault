import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { successResponse } from '../../common/utils/api-response.util';
import { VehicleIdParamDto } from '../vehicles/dto/vehicle-id-param.dto';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { MaintenanceRecordIdParamDto } from './dto/maintenance-record-id-param.dto';
import { UpdateMaintenanceRecordDto } from './dto/update-maintenance-record.dto';
import { MaintenanceService } from './maintenance.service';

@Controller()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('maintenance-records')
  async listMaintenance(@CurrentUser() user: AuthUser) {
    return successResponse(await this.maintenanceService.getAllRecords(user.id));
  }

  @Get('vehicles/:vehicleId/maintenance-records')
  async listVehicleMaintenance(
    @Param() params: VehicleIdParamDto,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.maintenanceService.listForVehicle(user.id, params.vehicleId, query);

    return successResponse(result.data, result.meta);
  }

  @Get('maintenance-records/:recordId')
  async getMaintenanceRecord(
    @Param() params: MaintenanceRecordIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.maintenanceService.getRecordById(user.id, params.recordId);
  }

  @Post('vehicles/:vehicleId/maintenance-records')
  async createMaintenanceRecord(
    @Param() params: VehicleIdParamDto,
    @Body() body: CreateMaintenanceRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.maintenanceService.createForVehicle(user.id, params.vehicleId, body);
  }

  @Patch('maintenance-records/:recordId')
  async updateMaintenanceRecord(
    @Param() params: MaintenanceRecordIdParamDto,
    @Body() body: UpdateMaintenanceRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.maintenanceService.updateRecord(user.id, params.recordId, body);
  }

  @Delete('maintenance-records/:recordId')
  async deleteMaintenanceRecord(
    @Param() params: MaintenanceRecordIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(await this.maintenanceService.deleteRecord(user.id, params.recordId));
  }
}
