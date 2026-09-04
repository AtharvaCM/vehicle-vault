import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { RemindersModule } from '../reminders/reminders.module';
import { VehicleDocumentsModule } from '../vehicle-documents/vehicle-documents.module';
import { VehicleLoansModule } from '../vehicle-loans/vehicle-loans.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    VehiclesModule,
    MaintenanceModule,
    RemindersModule,
    AttachmentsModule,
    VehicleLoansModule,
    VehicleDocumentsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
