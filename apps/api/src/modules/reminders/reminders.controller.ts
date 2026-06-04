import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { VehicleIdParamDto } from '../vehicles/dto/vehicle-id-param.dto';
import { ApplyServiceScheduleDto } from './dto/apply-service-schedule.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import { ReminderIdParamDto } from './dto/reminder-id-param.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RemindersService } from './reminders.service';
import { ServiceScheduleService } from './service-schedule.service';

@Controller()
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly serviceScheduleService: ServiceScheduleService,
  ) {}

  @Get('vehicles/:vehicleId/service-schedule/suggestions')
  async getServiceScheduleSuggestions(
    @Param() params: VehicleIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.serviceScheduleService.getSuggestions(user.id, params.vehicleId),
    );
  }

  @Post('vehicles/:vehicleId/service-schedule/apply')
  async applyServiceSchedule(
    @Param() params: VehicleIdParamDto,
    @Body() body: ApplyServiceScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.serviceScheduleService.applySuggestions(user.id, params.vehicleId, body.slugs),
    );
  }

  @Get('vehicles/:vehicleId/reminders')
  async listVehicleReminders(
    @Param() params: VehicleIdParamDto,
    @Query() query: ListRemindersQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.remindersService.listVehicleReminders(
      user.id,
      params.vehicleId,
      query,
    );

    return successResponse(result.data, result.meta);
  }

  @Get('reminders')
  async listReminders(@Query() query: ListRemindersQueryDto, @CurrentUser() user: AuthUser) {
    const result = await this.remindersService.listReminders(user.id, query);

    return successResponse(result.data, result.meta);
  }

  @Get('reminders/:reminderId')
  async getReminderById(@Param() params: ReminderIdParamDto, @CurrentUser() user: AuthUser) {
    return this.remindersService.getReminderById(user.id, params.reminderId);
  }

  @Post('vehicles/:vehicleId/reminders')
  async createReminder(
    @Param() params: VehicleIdParamDto,
    @Body() body: CreateReminderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.remindersService.createReminder(user.id, params.vehicleId, body);
  }

  @Patch('reminders/:reminderId')
  async updateReminder(
    @Param() params: ReminderIdParamDto,
    @Body() body: UpdateReminderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.remindersService.updateReminder(user.id, params.reminderId, body);
  }

  @Delete('reminders/:reminderId')
  async deleteReminder(@Param() params: ReminderIdParamDto, @CurrentUser() user: AuthUser) {
    return successResponse(await this.remindersService.deleteReminder(user.id, params.reminderId));
  }

  @Patch('reminders/:reminderId/complete')
  async completeReminder(@Param() params: ReminderIdParamDto, @CurrentUser() user: AuthUser) {
    return this.remindersService.completeReminder(user.id, params.reminderId);
  }
}
