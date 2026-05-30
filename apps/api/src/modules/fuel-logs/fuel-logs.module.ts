import { Module, type OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AppConfigModule } from '../../config/app-config.module';
import { AuditModule } from '../audit/audit.module';
import { ExtractionRegistry } from '../extraction/extraction-registry.service';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { FuelReceiptExtractionSpec } from './extractions/fuel-receipt.extraction';
import { FuelLogsController } from './fuel-logs.controller';
import { FuelLogsService } from './fuel-logs.service';

@Module({
  imports: [PrismaModule, VehiclesModule, AppConfigModule, AuditModule],
  controllers: [FuelLogsController],
  providers: [FuelLogsService, FuelReceiptExtractionSpec],
  exports: [FuelLogsService],
})
export class FuelLogsModule implements OnModuleInit {
  constructor(
    private readonly registry: ExtractionRegistry,
    private readonly fuelReceiptSpec: FuelReceiptExtractionSpec,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.fuelReceiptSpec);
  }
}
