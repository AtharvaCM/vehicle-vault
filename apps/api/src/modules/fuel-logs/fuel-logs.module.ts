import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AppConfigModule } from '../../config/app-config.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { FuelLogsController } from './fuel-logs.controller';
import { FuelLogsService } from './fuel-logs.service';
import { FuelLogsOCRService } from './fuel-logs-ocr.service';

@Module({
  imports: [PrismaModule, VehiclesModule, AppConfigModule],
  controllers: [FuelLogsController],
  providers: [FuelLogsService, FuelLogsOCRService],
  exports: [FuelLogsService],
})
export class FuelLogsModule {}
