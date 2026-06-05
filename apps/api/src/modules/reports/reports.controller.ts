import {
  Controller,
  Get,
  Header,
  Param,
  ParseFloatPipe,
  ParseUUIDPipe,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { ResaleReportService } from './resale-report.service';
import { ServiceHistoryService } from './service-history.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly serviceHistoryService: ServiceHistoryService,
    private readonly resaleReportService: ResaleReportService,
  ) {}

  @Get(':vehicleId/service-history.pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download a printable service history PDF for the vehicle' })
  async downloadServiceHistory(
    @CurrentUser('id') userId: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
  ): Promise<StreamableFile> {
    const { buffer, fileName } = await this.serviceHistoryService.buildPdf(userId, vehicleId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get(':vehicleId/resale-report.pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download a buyer-facing resale report PDF for the vehicle' })
  @ApiQuery({ name: 'askingPrice', required: false, type: Number })
  async downloadResaleReport(
    @CurrentUser('id') userId: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Query('askingPrice', new ParseFloatPipe({ optional: true })) askingPrice?: number,
  ): Promise<StreamableFile> {
    const { buffer, fileName } = await this.resaleReportService.buildPdf(userId, vehicleId, {
      askingPrice: askingPrice != null && askingPrice >= 0 ? askingPrice : undefined,
    });
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}
