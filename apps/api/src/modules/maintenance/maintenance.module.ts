import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { MaintenancePartsModule } from '../maintenance-parts/maintenance-parts.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [VehiclesModule, AuditModule, MaintenancePartsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
