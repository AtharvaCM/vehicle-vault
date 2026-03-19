import { Controller, Get } from '@nestjs/common';

import { successResponse } from '../../common/utils/api-response.util';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    return successResponse(this.dashboardService.getSummary());
  }
}
