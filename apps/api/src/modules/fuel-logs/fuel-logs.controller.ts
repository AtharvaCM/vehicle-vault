import 'multer';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { FuelReceiptExtractionDraft } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { ExtractionService } from '../extraction/extraction.service';
import { BulkCreateFuelLogDto } from './dto/bulk-create-fuel-log.dto';
import { CreateFuelLogDto } from './dto/create-fuel-log.dto';
import { UpdateFuelLogDto } from './dto/update-fuel-log.dto';
import { FuelLogsService } from './fuel-logs.service';

const FUEL_EXTRACTION_KIND = 'fuel_receipt';

@Controller('fuel-logs')
@UseGuards(JwtAuthGuard)
export class FuelLogsController {
  constructor(
    private readonly fuelLogsService: FuelLogsService,
    private readonly extractionService: ExtractionService,
  ) {}

  @Post('scan')
  @UseInterceptors(FileInterceptor('file'))
  async scanReceipt(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('A "file" multipart field is required.');
    }
    return this.extractionService.extract<FuelReceiptExtractionDraft>(
      FUEL_EXTRACTION_KIND,
      [{ buffer: file.buffer, mimeType: file.mimetype, name: file.originalname }],
    );
  }

  @Get('scan/status')
  async getScanStatus() {
    return {
      available:
        this.extractionService.isAvailable &&
        this.extractionService.hasKind(FUEL_EXTRACTION_KIND),
    };
  }

  @Get('vehicle/:vehicleId')
  async getByVehicle(@CurrentUser('id') userId: string, @Param('vehicleId') vehicleId: string) {
    return this.fuelLogsService.getFuelLogsByVehicle(userId, vehicleId);
  }

  @Get(':id')
  async getById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.fuelLogsService.getFuelLogById(userId, id);
  }

  @Post('vehicle/:vehicleId')
  async create(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateFuelLogDto,
  ) {
    return this.fuelLogsService.createFuelLog(userId, vehicleId, dto);
  }

  @Post('vehicle/:vehicleId/bulk')
  async createBulk(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() body: BulkCreateFuelLogDto,
  ) {
    return this.fuelLogsService.createBulkFuelLogs(userId, vehicleId, body.logs);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFuelLogDto,
  ) {
    return this.fuelLogsService.updateFuelLog(userId, id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.fuelLogsService.deleteFuelLog(userId, id);
  }
}
