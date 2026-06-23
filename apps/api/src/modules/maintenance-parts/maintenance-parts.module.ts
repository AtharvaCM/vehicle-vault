import { Module } from '@nestjs/common';

import { MaintenancePartsController } from './maintenance-parts.controller';
import { MaintenancePartsService } from './maintenance-parts.service';

@Module({
  controllers: [MaintenancePartsController],
  providers: [MaintenancePartsService],
  exports: [MaintenancePartsService],
})
export class MaintenancePartsModule {}
