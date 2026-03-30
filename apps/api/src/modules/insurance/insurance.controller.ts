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
import { type CreateInsurancePolicyInput, type UpdateInsurancePolicyInput } from '@vehicle-vault/shared';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { InsuranceService } from './insurance.service';

@Controller('vehicles/:vehicleId/insurance')
@UseGuards(JwtAuthGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get()
  async listForVehicle(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.insuranceService.listForVehicle(userId, vehicleId);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() payload: CreateInsurancePolicyInput,
  ) {
    return this.insuranceService.create(userId, vehicleId, payload);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() payload: UpdateInsurancePolicyInput,
  ) {
    return this.insuranceService.update(userId, id, payload);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.insuranceService.remove(userId, id);
  }
}
