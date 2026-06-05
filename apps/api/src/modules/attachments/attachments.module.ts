import { Module, type OnModuleInit } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ExtractionRegistry } from '../extraction/extraction-registry.service';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { VehicleLoansModule } from '../vehicle-loans/vehicle-loans.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { MaintenanceInvoiceExtractionSpec } from './extractions/maintenance-invoice.extraction';

@Module({
  imports: [MaintenanceModule, AuditModule, VehicleLoansModule, VehiclesModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, MaintenanceInvoiceExtractionSpec],
  exports: [AttachmentsService],
})
export class AttachmentsModule implements OnModuleInit {
  constructor(
    private readonly registry: ExtractionRegistry,
    private readonly maintenanceInvoiceSpec: MaintenanceInvoiceExtractionSpec,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.maintenanceInvoiceSpec);
  }
}
