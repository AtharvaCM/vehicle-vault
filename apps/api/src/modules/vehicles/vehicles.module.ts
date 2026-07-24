import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { VehiclesController } from './vehicles.controller';
import { VehicleAccessService } from './vehicle-access.service';
import { VehicleCatalogLinkerService } from './vehicle-catalog-linker.service';
import { VehicleInsightsService } from './vehicle-insights.service';
import { MaintenanceForecastService } from './maintenance-forecast.service';
import { MaintenanceIntervalResolver } from './maintenance-interval.resolver';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [AuditModule],
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    VehicleAccessService,
    VehicleCatalogLinkerService,
    VehicleInsightsService,
    MaintenanceForecastService,
    MaintenanceIntervalResolver,
  ],
  exports: [
    VehiclesService,
    VehicleAccessService,
    VehicleCatalogLinkerService,
    VehicleInsightsService,
    MaintenanceForecastService,
    MaintenanceIntervalResolver,
  ],
})
export class VehiclesModule {}
