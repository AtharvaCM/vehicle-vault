import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { successResponse } from '../../common/utils/api-response.util';
import { VehicleIdParamDto } from '../vehicles/dto/vehicle-id-param.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import { ReminderIdParamDto } from './dto/reminder-id-param.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RemindersService } from './reminders.service';

@Controller()
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('vehicles/:vehicleId/reminders')
  listVehicleReminders(@Param() params: VehicleIdParamDto, @Query() query: ListRemindersQueryDto) {
    const result = this.remindersService.listVehicleReminders(params.vehicleId, query);

    return successResponse(result.data, result.meta);
  }

  @Get('reminders')
  listReminders(@Query() query: ListRemindersQueryDto) {
    const result = this.remindersService.listReminders(query);

    return successResponse(result.data, result.meta);
  }

  @Get('reminders/:reminderId')
  getReminderById(@Param() params: ReminderIdParamDto) {
    return this.remindersService.getReminderById(params.reminderId);
  }

  @Post('vehicles/:vehicleId/reminders')
  createReminder(@Param() params: VehicleIdParamDto, @Body() body: CreateReminderDto) {
    return this.remindersService.createReminder(params.vehicleId, body);
  }

  @Patch('reminders/:reminderId')
  updateReminder(@Param() params: ReminderIdParamDto, @Body() body: UpdateReminderDto) {
    return this.remindersService.updateReminder(params.reminderId, body);
  }

  @Delete('reminders/:reminderId')
  deleteReminder(@Param() params: ReminderIdParamDto) {
    return successResponse(this.remindersService.deleteReminder(params.reminderId));
  }

  @Patch('reminders/:reminderId/complete')
  completeReminder(@Param() params: ReminderIdParamDto) {
    return this.remindersService.completeReminder(params.reminderId);
  }
}
