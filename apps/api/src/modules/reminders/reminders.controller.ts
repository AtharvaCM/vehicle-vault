import { Controller, Get, Query } from '@nestjs/common';

import { successResponse } from '../../common/utils/api-response.util';
import { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import { RemindersService } from './reminders.service';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  listReminders(@Query() query: ListRemindersQueryDto) {
    const result = this.remindersService.listReminders(query);

    return successResponse(result.data, result.meta);
  }
}
