import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { HistoryQueryDto } from './dto/history-query.dto';
import { HistoryService } from './history.service';

@ApiTags('History')
@ApiBearerAuth()
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @ApiOperation({
    summary: 'The garage timeline: service records, fuel fills and odometer readings, newest first',
  })
  async list(@CurrentUser('id') userId: string, @Query() query: HistoryQueryDto) {
    return successResponse(await this.historyService.list(userId, query));
  }
}
