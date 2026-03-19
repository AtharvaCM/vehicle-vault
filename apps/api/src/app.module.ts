import { Module } from '@nestjs/common';

import { AppConfigModule } from './config/app-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExportsModule } from './modules/exports/exports.module';
import { HealthModule } from './modules/health/health.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';

@Module({
  imports: [
    AppConfigModule,
    HealthModule,
    DashboardModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    MaintenanceModule,
    RemindersModule,
    AttachmentsModule,
    ExportsModule,
  ],
})
export class AppModule {}
