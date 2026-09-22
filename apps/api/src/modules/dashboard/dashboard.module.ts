import { Module } from '@nestjs/common';

import { AccessoriesModule } from '../accessories/accessories.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RemindersModule } from '../reminders/reminders.module';
import { TyresModule } from '../tyres/tyres.module';
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
    NotificationsModule,
    TyresModule,
    AccessoriesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
