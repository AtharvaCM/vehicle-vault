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
import type { CreateClaimInput, UpdateClaimInput } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { ClaimsService } from './claims.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get('vehicles/:vehicleId/claims')
  async listForVehicle(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.claimsService.listForVehicle(userId, vehicleId);
  }

  @Post('vehicles/:vehicleId/claims')
  async create(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() payload: CreateClaimInput,
  ) {
    return this.claimsService.create(userId, vehicleId, payload);
  }

  @Patch('claims/:id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() payload: UpdateClaimInput,
  ) {
    return this.claimsService.update(userId, id, payload);
  }

  @Delete('claims/:id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.claimsService.remove(userId, id);
    return { removed: true };
  }
}
