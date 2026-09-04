import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccessoriesModule } from '../accessories/accessories.module';
import { VehicleDocumentsModule } from '../vehicle-documents/vehicle-documents.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { MaintenanceAlertService } from './maintenance-alert.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotifyService } from './notify.service';
import { EmailChannel } from './channels/email.channel';
import { PushChannel } from './channels/push.channel';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { AccessoryWarrantyExpiringTemplate } from './templates/accessory-warranty-expiring.template';
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
  // VehicleDocumentsModule needs NotificationsService back (marking a superseded
  // document's alerts read on renewal), so this edge must be a forwardRef.
  imports: [
    PrismaModule,
    VehiclesModule,
    forwardRef(() => VehicleDocumentsModule),
    AccessoriesModule,
  ],
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
    AccessoryWarrantyExpiringTemplate,
    EmailChannel,
    PushSubscriptionsService,
    PushChannel,
    {
      provide: ALERT_TEMPLATES,
      useFactory: (
        maintenanceDue: MaintenanceDueTemplate,
        maintenanceOverdue: MaintenanceOverdueTemplate,
        reminderDue: ReminderDueTemplate,
        reminderOverdue: ReminderOverdueTemplate,
        documentExpiring: DocumentExpiringTemplate,
        accessoryWarrantyExpiring: AccessoryWarrantyExpiringTemplate,
      ): AlertTemplate<AlertKind>[] => [
        maintenanceDue,
        maintenanceOverdue,
        reminderDue,
        reminderOverdue,
        documentExpiring,
        accessoryWarrantyExpiring,
      ],
      inject: [
        MaintenanceDueTemplate,
        MaintenanceOverdueTemplate,
        ReminderDueTemplate,
        ReminderOverdueTemplate,
        DocumentExpiringTemplate,
        AccessoryWarrantyExpiringTemplate,
      ],
    },
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (email: EmailChannel, push: PushChannel): Channel[] => [email, push],
      inject: [EmailChannel, PushChannel],
    },
  ],
  exports: [NotificationsService, MaintenanceAlertService, NotifyService],
})
export class NotificationsModule {}
