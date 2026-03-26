import { Module } from '@nestjs/common';

import { PrismaModule } from './common/prisma/prisma.module';
import { SupabaseStorageModule } from './common/storage/supabase-storage.module';
import { AppConfigModule } from './config/app-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExportsModule } from './modules/exports/exports.module';
import { HealthModule } from './modules/health/health.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { UsersModule } from './modules/users/users.module';
import { VehicleCatalogModule } from './modules/vehicle-catalog/vehicle-catalog.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { FuelLogsModule } from './modules/fuel-logs/fuel-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    SupabaseStorageModule,
    HealthModule,
    DashboardModule,
    AuthModule,
    UsersModule,
    VehicleCatalogModule,
    VehiclesModule,
    MaintenanceModule,
    RemindersModule,
    FuelLogsModule,
    NotificationsModule,
    MailModule,
    AttachmentsModule,
    ExportsModule,
  ],
})
export class AppModule {}
