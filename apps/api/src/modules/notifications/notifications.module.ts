import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { VehicleDocumentsModule } from '../vehicle-documents/vehicle-documents.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { MaintenanceAlertService } from './maintenance-alert.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotifyService } from './notify.service';
import { EmailChannel } from './channels/email.channel';
import { DocumentExpiringTemplate } from './templates/document-expiring.template';
import { MaintenanceDueTemplate } from './templates/maintenance-due.template';
import { MaintenanceOverdueTemplate } from './templates/maintenance-overdue.template';
import { ReminderDueTemplate } from './templates/reminder-due.template';
import { ReminderOverdueTemplate } from './templates/reminder-overdue.template';
import {
  ALERT_TEMPLATES,
  NOTIFICATION_CHANNELS,
  type AlertKind,
  type AlertTemplate,
  type Channel,
} from './types';

@Module({
  imports: [PrismaModule, VehiclesModule, VehicleDocumentsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MaintenanceAlertService,
    NotifyService,
    MaintenanceDueTemplate,
    MaintenanceOverdueTemplate,
    ReminderDueTemplate,
    ReminderOverdueTemplate,
    DocumentExpiringTemplate,
    EmailChannel,
    {
      provide: ALERT_TEMPLATES,
      useFactory: (
        maintenanceDue: MaintenanceDueTemplate,
        maintenanceOverdue: MaintenanceOverdueTemplate,
        reminderDue: ReminderDueTemplate,
        reminderOverdue: ReminderOverdueTemplate,
        documentExpiring: DocumentExpiringTemplate,
      ): AlertTemplate<AlertKind>[] => [
        maintenanceDue,
        maintenanceOverdue,
        reminderDue,
        reminderOverdue,
        documentExpiring,
      ],
      inject: [
        MaintenanceDueTemplate,
        MaintenanceOverdueTemplate,
        ReminderDueTemplate,
        ReminderOverdueTemplate,
        DocumentExpiringTemplate,
      ],
    },
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (email: EmailChannel): Channel[] => [email],
      inject: [EmailChannel],
    },
  ],
  exports: [NotificationsService, MaintenanceAlertService, NotifyService],
})
export class NotificationsModule {}
