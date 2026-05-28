import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { successResponse } from '../../common/utils/api-response.util';
import { AuditQueryService, type AuditQueryFilters } from './audit-query.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get('audit/me')
  @ApiOperation({ summary: 'List audit events where the caller is actor or owner' })
  async listForMe(@CurrentUser('id') userId: string, @Query() query: AuditQueryDto) {
    const result = await this.auditQueryService.listForOwner(userId, this.toFilters(query));
    return successResponse(result);
  }

  @Get('vehicles/:vehicleId/audit')
  @ApiOperation({ summary: 'List audit events for one vehicle and its descendants' })
  async listForVehicle(
    @CurrentUser('id') userId: string,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Query() query: AuditQueryDto,
  ) {
    const result = await this.auditQueryService.listForVehicle(
      userId,
      vehicleId,
      this.toFilters(query),
    );
    return successResponse(result);
  }

  private toFilters(query: AuditQueryDto): AuditQueryFilters {
    return {
      resourceType: query.resourceType,
      action: query.action,
      actionPrefix: query.actionPrefix,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      cursor: query.cursor,
      limit: query.limit,
    };
  }
}
