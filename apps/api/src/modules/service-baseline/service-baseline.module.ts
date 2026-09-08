import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ServiceBaselineController } from './service-baseline.controller';
import { ServiceBaselineService } from './service-baseline.service';

@Module({
  imports: [PrismaModule, VehiclesModule, AuditModule],
  controllers: [ServiceBaselineController],
  providers: [ServiceBaselineService],
  exports: [ServiceBaselineService],
})
export class ServiceBaselineModule {}
