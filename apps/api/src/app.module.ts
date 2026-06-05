import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

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
import { MailModule } from './common/mail/mail.module';
import { VehicleDocumentsModule } from './modules/vehicle-documents/vehicle-documents.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { AdminModule } from './modules/admin/admin.module';
import { VehicleLoansModule } from './modules/vehicle-loans/vehicle-loans.module';
import { VehicleSharingModule } from './modules/vehicle-sharing/vehicle-sharing.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    PrismaModule,
    SupabaseStorageModule,
    ExtractionModule,
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
    VehicleDocumentsModule,
    ClaimsModule,
    AnalyticsModule,
    ReportsModule,
    AuditModule,
    AdminModule,
    VehicleLoansModule,
    VehicleSharingModule,
  ],
})
export class AppModule {}
