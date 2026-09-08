import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TyresModule } from '../tyres/tyres.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { ServiceScheduleService } from './service-schedule.service';

// Reminders → Tyres is safe in this direction only. Notifications already
// depends on Tyres, and Reminders depends on Notifications, so a Tyres →
// Reminders edge would close the cycle — which is why the tyre walk-around is
// anchored by asking Tyres rather than by Tyres pushing a reminder.
@Module({
  imports: [VehiclesModule, AuditModule, NotificationsModule, TyresModule],
  controllers: [RemindersController],
  providers: [RemindersService, ServiceScheduleService],
  exports: [RemindersService, ServiceScheduleService],
})
export class RemindersModule {}
