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
  async listVehicleReminders(
    @Param() params: VehicleIdParamDto,
    @Query() query: ListRemindersQueryDto,
  ) {
    const result = await this.remindersService.listVehicleReminders(params.vehicleId, query);

    return successResponse(result.data, result.meta);
  }

  @Get('reminders')
  async listReminders(@Query() query: ListRemindersQueryDto) {
    const result = await this.remindersService.listReminders(query);

    return successResponse(result.data, result.meta);
  }

  @Get('reminders/:reminderId')
  async getReminderById(@Param() params: ReminderIdParamDto) {
    return this.remindersService.getReminderById(params.reminderId);
  }

  @Post('vehicles/:vehicleId/reminders')
  async createReminder(@Param() params: VehicleIdParamDto, @Body() body: CreateReminderDto) {
    return this.remindersService.createReminder(params.vehicleId, body);
  }

  @Patch('reminders/:reminderId')
  async updateReminder(@Param() params: ReminderIdParamDto, @Body() body: UpdateReminderDto) {
    return this.remindersService.updateReminder(params.reminderId, body);
  }

  @Delete('reminders/:reminderId')
  async deleteReminder(@Param() params: ReminderIdParamDto) {
    return successResponse(await this.remindersService.deleteReminder(params.reminderId));
  }

  @Patch('reminders/:reminderId/complete')
  async completeReminder(@Param() params: ReminderIdParamDto) {
    return this.remindersService.completeReminder(params.reminderId);
  }
}
