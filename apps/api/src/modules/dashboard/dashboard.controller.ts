import { BadRequestException, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  VehicleDocumentKindSchema,
  type AuthUser,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary statistics' })
  async getSummary(@CurrentUser() user: AuthUser) {
    return successResponse(await this.dashboardService.getSummary(user.id));
  }

  @Post('attention/documents/:kind/:id/snooze')
  @ApiOperation({ summary: 'Snooze a document-expiry row out of the attention queue' })
  async snoozeDocument(
    @CurrentUser() user: AuthUser,
    @Param('kind') kindParam: string,
    @Param('id') id: string,
  ) {
    const kind = parseKind(kindParam);
    await this.dashboardService.snoozeDocumentAttention(user.id, kind, id);
    return successResponse({ snoozed: true });
  }
}

function parseKind(value: string): VehicleDocumentKind {
  const parsed = VehicleDocumentKindSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(
      `Invalid "kind" parameter. Expected one of: ${VehicleDocumentKindSchema.options.join(', ')}`,
    );
  }
  return parsed.data;
}
