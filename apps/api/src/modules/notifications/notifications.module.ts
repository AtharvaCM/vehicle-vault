import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccessoriesModule } from '../accessories/accessories.module';
import { TyresModule } from '../tyres/tyres.module';
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
import { TyreAgedTemplate } from './templates/tyre-aged.template';
import { TyreUninspectedTemplate } from './templates/tyre-uninspected.template';
import { TyreWornTemplate } from './templates/tyre-worn.template';
import {
  ALERT_TEMPLATES,
  NOTIFICATION_CHANNELS,
  type AlertKind,
  type AlertTemplate,
  type Channel,
} from './types';

/**
 * One list, used as both the provider registration and the multi-provider's
 * `inject`. Naming each template in three separate places is how a registered
 * template ends up missing from the factory it feeds, and `NotifyService.raise`
 * only discovers that at runtime, on the alert nobody received.
 */
export const ALERT_TEMPLATE_PROVIDERS = [
  MaintenanceDueTemplate,
  MaintenanceOverdueTemplate,
  ReminderDueTemplate,
  ReminderOverdueTemplate,
  DocumentExpiringTemplate,
  AccessoryWarrantyExpiringTemplate,
  TyreWornTemplate,
  TyreAgedTemplate,
  TyreUninspectedTemplate,
];

@Module({
  // VehicleDocumentsModule needs NotificationsService back (marking a superseded
  // document's alerts read on renewal), so this edge must be a forwardRef.
  imports: [
    PrismaModule,
    VehiclesModule,
    forwardRef(() => VehicleDocumentsModule),
    AccessoriesModule,
    TyresModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MaintenanceAlertService,
    NotifyService,
    ...ALERT_TEMPLATE_PROVIDERS,
    EmailChannel,
    PushSubscriptionsService,
    PushChannel,
    {
      provide: ALERT_TEMPLATES,
      useFactory: (...templates: AlertTemplate<AlertKind>[]) => templates,
      inject: ALERT_TEMPLATE_PROVIDERS,
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
