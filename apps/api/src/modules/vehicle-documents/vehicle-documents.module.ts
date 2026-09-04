import { forwardRef, Module, type OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ExtractionRegistry } from '../extraction/extraction-registry.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { PucAdapter, RegistrationAdapter, RoadTaxAdapter } from './adapters/compliance.adapter';
import { InsuranceAdapter } from './adapters/insurance.adapter';
import { WarrantyAdapter } from './adapters/warranty.adapter';
import { ComplianceDocumentExtractionSpec } from './extractions/compliance-document.extraction';
import { InsurancePolicyExtractionSpec } from './extractions/insurance-policy.extraction';
import { WarrantyDocumentExtractionSpec } from './extractions/warranty-document.extraction';
import { VehicleDocumentsController } from './vehicle-documents.controller';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { VEHICLE_DOCUMENT_ADAPTERS, type VehicleDocumentAdapter } from './types';

@Module({
  // NotificationsModule needs VehicleDocumentsService (the alert engine reads
  // expiring documents), so this edge must be a forwardRef.
  imports: [PrismaModule, VehiclesModule, AuditModule, forwardRef(() => NotificationsModule)],
  controllers: [VehicleDocumentsController],
  providers: [
    VehicleDocumentsService,
    InsuranceAdapter,
    WarrantyAdapter,
    RegistrationAdapter,
    PucAdapter,
    RoadTaxAdapter,
    InsurancePolicyExtractionSpec,
    WarrantyDocumentExtractionSpec,
    ComplianceDocumentExtractionSpec,
    {
      provide: VEHICLE_DOCUMENT_ADAPTERS,
      useFactory: (
        insurance: InsuranceAdapter,
        warranty: WarrantyAdapter,
        registration: RegistrationAdapter,
        puc: PucAdapter,
        roadTax: RoadTaxAdapter,
      ): VehicleDocumentAdapter[] => [insurance, warranty, registration, puc, roadTax],
      inject: [InsuranceAdapter, WarrantyAdapter, RegistrationAdapter, PucAdapter, RoadTaxAdapter],
    },
  ],
  exports: [VehicleDocumentsService],
})
export class VehicleDocumentsModule implements OnModuleInit {
  constructor(
    private readonly registry: ExtractionRegistry,
    private readonly insurancePolicySpec: InsurancePolicyExtractionSpec,
    private readonly warrantyDocumentSpec: WarrantyDocumentExtractionSpec,
    private readonly complianceDocumentSpec: ComplianceDocumentExtractionSpec,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.insurancePolicySpec);
    this.registry.register(this.warrantyDocumentSpec);
    this.registry.register(this.complianceDocumentSpec);
  }
}
