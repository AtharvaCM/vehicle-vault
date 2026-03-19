import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

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

  @Get('vehicles/:vehicleId/maintenance-records')
  listVehicleMaintenance(@Param() params: VehicleIdParamDto, @Query() query: PaginationQueryDto) {
    const result = this.maintenanceService.listForVehicle(params.vehicleId, query);

    return successResponse(result.data, result.meta);
  }

  @Get('maintenance-records/:recordId')
  getMaintenanceRecord(@Param() params: MaintenanceRecordIdParamDto) {
    return this.maintenanceService.getRecordById(params.recordId);
  }

  @Post('vehicles/:vehicleId/maintenance-records')
  createMaintenanceRecord(
    @Param() params: VehicleIdParamDto,
    @Body() body: CreateMaintenanceRecordDto,
  ) {
    return this.maintenanceService.createForVehicle(params.vehicleId, body);
  }

  @Patch('maintenance-records/:recordId')
  updateMaintenanceRecord(
    @Param() params: MaintenanceRecordIdParamDto,
    @Body() body: UpdateMaintenanceRecordDto,
  ) {
    return this.maintenanceService.updateRecord(params.recordId, body);
  }

  @Delete('maintenance-records/:recordId')
  deleteMaintenanceRecord(@Param() params: MaintenanceRecordIdParamDto) {
    return successResponse(this.maintenanceService.deleteRecord(params.recordId));
  }
}
