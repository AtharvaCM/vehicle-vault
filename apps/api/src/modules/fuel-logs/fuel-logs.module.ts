import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { FuelLogsController } from './fuel-logs.controller';
import { FuelLogsService } from './fuel-logs.service';

@Module({
  imports: [PrismaModule, VehiclesModule],
  controllers: [FuelLogsController],
  providers: [FuelLogsService],
  exports: [FuelLogsService],
})
export class FuelLogsModule {}
