import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { ServiceHistoryService } from './service-history.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly serviceHistoryService: ServiceHistoryService) {}

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
}
