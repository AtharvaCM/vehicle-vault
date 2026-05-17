import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ClaimAttachmentsController } from './claim-attachments.controller';
import { ClaimAttachmentsService } from './claim-attachments.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  imports: [PrismaModule, VehiclesModule],
  controllers: [ClaimsController, ClaimAttachmentsController],
  providers: [ClaimsService, ClaimAttachmentsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
