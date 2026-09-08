import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { VehicleIdParamDto } from '../vehicles/dto/vehicle-id-param.dto';
import { ServiceBaselineService } from './service-baseline.service';
import { UpsertServiceBaselineDto } from './dto/upsert-service-baseline.dto';

@ApiTags('Service baseline')
@ApiBearerAuth()
@Controller()
export class ServiceBaselineController {
  constructor(private readonly serviceBaselineService: ServiceBaselineService) {}

  @Get('vehicles/:vehicleId/service-baseline')
  @ApiOperation({
    summary: "What the app knows about a vehicle's service history, per category",
  })
  async getCoverage(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return successResponse(
      await this.serviceBaselineService.getCoverage(user.id, params.vehicleId),
    );
  }

  @Put('vehicles/:vehicleId/service-baseline')
  @ApiOperation({
    summary: 'Record what was last done, or that it is unknown, for one or more categories',
    description:
      'Idempotent upsert. Categories absent from the body keep whatever they had, so a ' +
      'partially answered history is not treated as a retraction of the rest.',
  })
  async upsert(
    @CurrentUser() user: AuthUser,
    @Param() params: VehicleIdParamDto,
    @Body() body: UpsertServiceBaselineDto,
  ) {
    return successResponse(
      await this.serviceBaselineService.upsertForVehicle(user.id, params.vehicleId, body),
    );
  }
}
