import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { VehiclesController } from './vehicles.controller';
import { VehicleAccessService } from './vehicle-access.service';
import { VehicleInsightsService } from './vehicle-insights.service';
import { MaintenanceForecastService } from './maintenance-forecast.service';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [AuditModule],
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    VehicleAccessService,
    VehicleInsightsService,
    MaintenanceForecastService,
  ],
  exports: [
    VehiclesService,
    VehicleAccessService,
    VehicleInsightsService,
    MaintenanceForecastService,
  ],
})
export class VehiclesModule {}
