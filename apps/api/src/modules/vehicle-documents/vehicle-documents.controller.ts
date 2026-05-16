import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  VehicleDocumentKindSchema,
  type CreateVehicleDocumentInput,
  type UpdateVehicleDocumentInput,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { VehicleDocumentsService } from './vehicle-documents.service';

const KIND_VALUES = VehicleDocumentKindSchema.options;

@Controller('vehicles/:vehicleId/documents')
@UseGuards(JwtAuthGuard)
export class VehicleDocumentsController {
  constructor(private readonly vehicleDocumentsService: VehicleDocumentsService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Query('kind') kind?: string,
  ) {
    const parsedKind = parseOptionalKind(kind);
    return this.vehicleDocumentsService.listForVehicle(userId, vehicleId, parsedKind);
  }

  @Get('active')
  async listActive(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Query('date') date?: string,
    @Query('kind') kind?: string,
  ) {
    const at = date ? new Date(date) : new Date();
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('Invalid "date" query parameter.');
    }
    const parsedKind = parseOptionalKind(kind);
    return this.vehicleDocumentsService.activeCoverageAt(userId, vehicleId, at, parsedKind);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() payload: CreateVehicleDocumentInput,
  ) {
    return this.vehicleDocumentsService.create(userId, vehicleId, payload);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() payload: UpdateVehicleDocumentInput,
  ) {
    return this.vehicleDocumentsService.update(userId, id, payload);
  }

  @Delete(':kind/:id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('kind') kindParam: string,
    @Param('id') id: string,
  ) {
    const kind = parseRequiredKind(kindParam);
    await this.vehicleDocumentsService.remove(userId, kind, id);
    return { removed: true };
  }
}

function parseRequiredKind(value: string): VehicleDocumentKind {
  const parsed = VehicleDocumentKindSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(
      `Invalid "kind" path parameter. Expected one of: ${KIND_VALUES.join(', ')}`,
    );
  }
  return parsed.data;
}

function parseOptionalKind(value: string | undefined): VehicleDocumentKind | undefined {
  if (!value) return undefined;
  const parsed = VehicleDocumentKindSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(
      `Invalid "kind" query parameter. Expected one of: ${KIND_VALUES.join(', ')}`,
    );
  }
  return parsed.data;
}
