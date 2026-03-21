import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { RemindersModule } from '../reminders/reminders.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [VehiclesModule, MaintenanceModule, RemindersModule, AttachmentsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
