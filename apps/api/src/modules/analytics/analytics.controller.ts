import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { successResponse } from '../../common/utils/api-response.util';
import { AnalyticsService } from './analytics.service';
import { CostSplitQueryDto } from './dto/cost-split-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('cost-split')
  @ApiOperation({ summary: 'Cost split across fuel, maintenance, and insurance' })
  async getCostSplit(@CurrentUser('id') userId: string, @Query() query: CostSplitQueryDto) {
    const result = await this.analyticsService.getCostSplit(userId, {
      vehicleId: query.vehicleId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return successResponse(result);
  }

  @Get('cost-trend')
  @ApiOperation({ summary: 'Monthly cost trend with km and cost-per-km' })
  async getCostTrend(@CurrentUser('id') userId: string, @Query() query: CostSplitQueryDto) {
    const result = await this.analyticsService.getCostTrend(userId, {
      vehicleId: query.vehicleId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return successResponse(result);
  }

  @Get('tco/:vehicleId')
  @ApiOperation({ summary: 'Lifetime total cost of ownership for one vehicle' })
  async getTco(
    @CurrentUser('id') userId: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
  ) {
    const result = await this.analyticsService.getTco(userId, vehicleId);
    return successResponse(result);
  }
}
