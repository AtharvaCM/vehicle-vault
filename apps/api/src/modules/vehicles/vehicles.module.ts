import { Module } from '@nestjs/common';

import { VehiclesController } from './vehicles.controller';
import { VehicleInsightsService } from './vehicle-insights.service';
import { MaintenanceForecastService } from './maintenance-forecast.service';
import { VehiclesService } from './vehicles.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleInsightsService, MaintenanceForecastService],
  exports: [VehiclesService, VehicleInsightsService, MaintenanceForecastService],
})
export class VehiclesModule {}
