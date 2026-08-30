import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { TyreConditionResolver } from './tyre-condition.resolver';
import { TyresController } from './tyres.controller';
import { TyresService } from './tyres.service';

@Module({
  imports: [PrismaModule, VehiclesModule, AuditModule],
  controllers: [TyresController],
  providers: [TyresService, TyreConditionResolver],
  exports: [TyresService, TyreConditionResolver],
})
export class TyresModule {}
