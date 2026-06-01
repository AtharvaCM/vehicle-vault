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
import type { LoanDocumentExtractionDraft } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { ExtractionService } from '../extraction/extraction.service';
import { CreateVehicleLoanDto } from './dto/create-vehicle-loan.dto';
import { CreateLoanPrepaymentDto } from './dto/create-loan-prepayment.dto';
import { ForecloseLoanDto } from './dto/foreclose-loan.dto';
import { UpdateVehicleLoanDto } from './dto/update-vehicle-loan.dto';
import { VehicleLoansService } from './vehicle-loans.service';

const LOAN_EXTRACTION_KIND = 'loan_document';

@Controller('vehicle-loans')
@UseGuards(JwtAuthGuard)
export class VehicleLoansController {
  constructor(
    private readonly vehicleLoansService: VehicleLoansService,
    private readonly extractionService: ExtractionService,
  ) {}

  @Post('scan')
  @UseInterceptors(FileInterceptor('file'))
  async scanDocument(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('A "file" multipart field is required.');
    }
    return this.extractionService.extract<LoanDocumentExtractionDraft>(
      LOAN_EXTRACTION_KIND,
      [{ buffer: file.buffer, mimeType: file.mimetype, name: file.originalname }],
    );
  }

  @Get('scan/status')
  async getScanStatus() {
    return {
      available:
        this.extractionService.isAvailable &&
        this.extractionService.hasKind(LOAN_EXTRACTION_KIND),
    };
  }

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.vehicleLoansService.listForUser(userId);
  }

  @Get('vehicle/:vehicleId')
  async listByVehicle(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehicleLoansService.listForVehicle(userId, vehicleId);
  }

  @Get(':id')
  async getById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.vehicleLoansService.getById(userId, id);
  }

  @Post('vehicle/:vehicleId')
  async create(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateVehicleLoanDto,
  ) {
    return this.vehicleLoansService.createForVehicle(userId, vehicleId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleLoanDto,
  ) {
    return this.vehicleLoansService.updateLoan(userId, id, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.vehicleLoansService.deleteLoan(userId, id);
  }

  @Get(':id/schedule')
  async getSchedule(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.vehicleLoansService.getSchedule(userId, id);
  }

  @Post(':id/prepayments')
  async addPrepayment(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateLoanPrepaymentDto,
  ) {
    return this.vehicleLoansService.addPrepayment(userId, id, dto);
  }

  @Delete(':id/prepayments/:prepaymentId')
  async deletePrepayment(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('prepaymentId') prepaymentId: string,
  ) {
    return this.vehicleLoansService.deletePrepayment(userId, id, prepaymentId);
  }

  @Post(':id/foreclose')
  async foreclose(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ForecloseLoanDto,
  ) {
    return this.vehicleLoansService.forecloseLoan(userId, id, dto);
  }
}
