import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { MaintenanceAlertService } from './maintenance-alert.service';

@Module({
  imports: [PrismaModule, VehiclesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MaintenanceAlertService],
  exports: [NotificationsService, MaintenanceAlertService],
})
export class NotificationsModule {}
