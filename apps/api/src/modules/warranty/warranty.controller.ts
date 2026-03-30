import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type CreateWarrantyInput, type UpdateWarrantyInput } from '@vehicle-vault/shared';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { WarrantyService } from './warranty.service';

@Controller('vehicles/:vehicleId/warranty')
@UseGuards(JwtAuthGuard)
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Get()
  async listForVehicle(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.warrantyService.listForVehicle(userId, vehicleId);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() payload: CreateWarrantyInput,
  ) {
    return this.warrantyService.create(userId, vehicleId, payload);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() payload: UpdateWarrantyInput,
  ) {
    return this.warrantyService.update(userId, id, payload);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.warrantyService.remove(userId, id);
  }
}
