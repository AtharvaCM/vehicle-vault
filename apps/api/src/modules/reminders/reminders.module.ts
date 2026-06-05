import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { ServiceScheduleService } from './service-schedule.service';

@Module({
  imports: [VehiclesModule, AuditModule],
  controllers: [RemindersController],
  providers: [RemindersService, ServiceScheduleService],
  exports: [RemindersService, ServiceScheduleService],
})
export class RemindersModule {}
