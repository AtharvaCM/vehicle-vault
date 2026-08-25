import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { VehicleIdParamDto } from '../vehicles/dto/vehicle-id-param.dto';
import { CreateTyreDto } from './dto/create-tyre.dto';
import { CreateTyreInspectionDto } from './dto/create-tyre-inspection.dto';
import { UpdateTyreDto } from './dto/update-tyre.dto';
import { TyresService } from './tyres.service';

@ApiTags('Tyres')
@ApiBearerAuth()
@Controller()
export class TyresController {
  constructor(private readonly tyresService: TyresService) {}

  @Get('vehicles/:vehicleId/tyres')
  @ApiOperation({ summary: 'List tyres fitted to a vehicle, including retired ones' })
  async listTyres(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return successResponse(await this.tyresService.listForVehicle(user.id, params.vehicleId));
  }

  @Post('vehicles/:vehicleId/tyres')
  @ApiOperation({ summary: 'Fit a tyre, retiring whatever occupied that position' })
  async createTyre(
    @CurrentUser() user: AuthUser,
    @Param() params: VehicleIdParamDto,
    @Body() body: CreateTyreDto,
  ) {
    return successResponse(
      await this.tyresService.createForVehicle(user.id, params.vehicleId, body),
    );
  }

  @Get('vehicles/:vehicleId/tyres/condition')
  @ApiOperation({ summary: 'Measured condition of the currently fitted tyres' })
  async getCondition(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return successResponse(
      await this.tyresService.getVehicleCondition(user.id, params.vehicleId),
    );
  }

  @Get('vehicles/:vehicleId/tyre-inspections')
  @ApiOperation({ summary: 'List tyre inspection readings for a vehicle' })
  async listInspections(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return successResponse(await this.tyresService.listInspections(user.id, params.vehicleId));
  }

  @Post('vehicles/:vehicleId/tyre-inspections')
  @ApiOperation({ summary: 'Record a tread depth or pressure reading for one tyre' })
  async createInspection(
    @CurrentUser() user: AuthUser,
    @Param() params: VehicleIdParamDto,
    @Body() body: CreateTyreInspectionDto,
  ) {
    return successResponse(
      await this.tyresService.createInspection(user.id, params.vehicleId, body),
    );
  }

  @Patch('tyres/:tyreId')
  @ApiOperation({ summary: 'Update a tyre' })
  async updateTyre(
    @CurrentUser() user: AuthUser,
    @Param('tyreId') tyreId: string,
    @Body() body: UpdateTyreDto,
  ) {
    return successResponse(await this.tyresService.updateTyre(user.id, tyreId, body));
  }

  @Delete('tyres/:tyreId')
  @ApiOperation({ summary: 'Delete a tyre and its inspection history' })
  async deleteTyre(@CurrentUser() user: AuthUser, @Param('tyreId') tyreId: string) {
    return successResponse(await this.tyresService.deleteTyre(user.id, tyreId));
  }
}
