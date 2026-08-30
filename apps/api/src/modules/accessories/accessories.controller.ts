import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { VehicleIdParamDto } from '../vehicles/dto/vehicle-id-param.dto';
import { AccessoriesService } from './accessories.service';
import { AccessoryIdParamDto } from './dto/accessory-id-param.dto';
import { CreateAccessoryDto } from './dto/create-accessory.dto';
import { UpdateAccessoryDto } from './dto/update-accessory.dto';

@ApiTags('Accessories')
@ApiBearerAuth()
@Controller()
export class AccessoriesController {
  constructor(private readonly accessoriesService: AccessoriesService) {}

  @Get('vehicles/:vehicleId/accessories')
  @ApiOperation({ summary: 'List accessories bought for a vehicle, fitted and removed' })
  async listAccessories(@CurrentUser() user: AuthUser, @Param() params: VehicleIdParamDto) {
    return successResponse(
      await this.accessoriesService.listForVehicle(user.id, params.vehicleId),
    );
  }

  @Post('vehicles/:vehicleId/accessories')
  @ApiOperation({ summary: 'Record an accessory bought for a vehicle' })
  async createAccessory(
    @CurrentUser() user: AuthUser,
    @Param() params: VehicleIdParamDto,
    @Body() body: CreateAccessoryDto,
  ) {
    return successResponse(
      await this.accessoriesService.createForVehicle(user.id, params.vehicleId, body),
    );
  }

  @Patch('accessories/:accessoryId')
  @ApiOperation({ summary: 'Update an accessory, including marking it removed' })
  async updateAccessory(
    @CurrentUser() user: AuthUser,
    @Param() params: AccessoryIdParamDto,
    @Body() body: UpdateAccessoryDto,
  ) {
    return successResponse(
      await this.accessoriesService.updateAccessory(user.id, params.accessoryId, body),
    );
  }

  @Delete('accessories/:accessoryId')
  @ApiOperation({ summary: 'Delete an accessory' })
  async deleteAccessory(
    @CurrentUser() user: AuthUser,
    @Param() params: AccessoryIdParamDto,
  ) {
    return successResponse(
      await this.accessoriesService.deleteAccessory(user.id, params.accessoryId),
    );
  }
}
