import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MaintenanceRecordCreateSchema } from '@vehicle-vault/shared';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ZodSchemaValidationPipe } from '../../common/pipes/zod-schema-validation.pipe';
import { successResponse } from '../../common/utils/api-response.util';
import { VehicleIdParamDto } from '../vehicles/dto/vehicle-id-param.dto';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('vehicles/:vehicleId/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  listVehicleMaintenance(@Param() params: VehicleIdParamDto, @Query() query: PaginationQueryDto) {
    const result = this.maintenanceService.listForVehicle(params.vehicleId, query);

    return successResponse(result.data, result.meta);
  }

  @Post()
  createMaintenanceRecord(
    @Param() params: VehicleIdParamDto,
    @Body(new ZodSchemaValidationPipe(MaintenanceRecordCreateSchema.omit({ vehicleId: true })))
    body: CreateMaintenanceRecordDto,
  ) {
    return this.maintenanceService.createForVehicle(params.vehicleId, body);
  }
}
