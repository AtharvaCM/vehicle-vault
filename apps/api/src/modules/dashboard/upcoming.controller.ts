import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { DashboardService } from './dashboard.service';
import { UpcomingQueryDto } from './dto/upcoming-query.dto';

/**
 * The Upcoming page's timeline. It lives beside Home's summary because it is
 * the same classification over a longer window: see `due-items.ts`.
 */
@ApiTags('Upcoming')
@ApiBearerAuth()
@Controller('upcoming')
export class UpcomingController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Everything due across vehicles, grouped as Home groups it' })
  async getTimeline(@CurrentUser() user: AuthUser, @Query() query: UpcomingQueryDto) {
    const result = await this.dashboardService.getUpcoming(user.id, query);

    return successResponse(result.timeline, {
      page: result.page,
      limit: result.limit,
      total: result.laterTotal,
    });
  }
}
