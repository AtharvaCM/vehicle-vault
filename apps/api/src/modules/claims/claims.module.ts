import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  imports: [PrismaModule, VehiclesModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
