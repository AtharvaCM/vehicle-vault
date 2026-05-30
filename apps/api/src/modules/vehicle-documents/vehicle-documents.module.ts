import { Module, type OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ExtractionRegistry } from '../extraction/extraction-registry.service';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { InsuranceAdapter } from './adapters/insurance.adapter';
import { WarrantyAdapter } from './adapters/warranty.adapter';
import { InsurancePolicyExtractionSpec } from './extractions/insurance-policy.extraction';
import { VehicleDocumentsController } from './vehicle-documents.controller';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { VEHICLE_DOCUMENT_ADAPTERS, type VehicleDocumentAdapter } from './types';

@Module({
  imports: [PrismaModule, VehiclesModule, AuditModule],
  controllers: [VehicleDocumentsController],
  providers: [
    VehicleDocumentsService,
    InsuranceAdapter,
    WarrantyAdapter,
    InsurancePolicyExtractionSpec,
    {
      provide: VEHICLE_DOCUMENT_ADAPTERS,
      useFactory: (
        insurance: InsuranceAdapter,
        warranty: WarrantyAdapter,
      ): VehicleDocumentAdapter[] => [insurance, warranty],
      inject: [InsuranceAdapter, WarrantyAdapter],
    },
  ],
  exports: [VehicleDocumentsService],
})
export class VehicleDocumentsModule implements OnModuleInit {
  constructor(
    private readonly registry: ExtractionRegistry,
    private readonly insurancePolicySpec: InsurancePolicyExtractionSpec,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.insurancePolicySpec);
  }
}
