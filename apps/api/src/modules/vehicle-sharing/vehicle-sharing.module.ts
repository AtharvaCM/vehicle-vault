import { Module } from '@nestjs/common';

import { MailModule } from '../../common/mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { VehicleInvitesService } from './vehicle-invites.service';
import { VehicleMembersService } from './vehicle-members.service';
import { VehicleSharingController } from './vehicle-sharing.controller';

@Module({
  imports: [VehiclesModule, AuditModule, MailModule],
  controllers: [VehicleSharingController],
  providers: [VehicleInvitesService, VehicleMembersService],
  exports: [VehicleInvitesService, VehicleMembersService],
})
export class VehicleSharingModule {}
