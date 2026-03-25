import { Module } from '@nestjs/common';

import { VehiclesController } from './vehicles.controller';
import { VehicleInsightsService } from './vehicle-insights.service';
import { VehiclesService } from './vehicles.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleInsightsService],
  exports: [VehiclesService, VehicleInsightsService],
})
export class VehiclesModule {}
