import { Module, type OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ExtractionRegistry } from '../extraction/extraction-registry.service';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { LoanDocumentExtractionSpec } from './extractions/loan-document.extraction';
import { VehicleLoansController } from './vehicle-loans.controller';
import { VehicleLoansService } from './vehicle-loans.service';

@Module({
  imports: [PrismaModule, VehiclesModule, AuditModule],
  controllers: [VehicleLoansController],
  providers: [VehicleLoansService, LoanDocumentExtractionSpec],
  exports: [VehicleLoansService],
})
export class VehicleLoansModule implements OnModuleInit {
  constructor(
    private readonly registry: ExtractionRegistry,
    private readonly loanDocumentSpec: LoanDocumentExtractionSpec,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.loanDocumentSpec);
  }
}
