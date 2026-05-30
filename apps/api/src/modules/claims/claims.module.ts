import { Module, type OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ExtractionRegistry } from '../extraction/extraction-registry.service';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ClaimAttachmentsController } from './claim-attachments.controller';
import { ClaimAttachmentsService } from './claim-attachments.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ClaimDocumentExtractionSpec } from './extractions/claim-document.extraction';

@Module({
  imports: [PrismaModule, VehiclesModule, AuditModule],
  controllers: [ClaimsController, ClaimAttachmentsController],
  providers: [ClaimsService, ClaimAttachmentsService, ClaimDocumentExtractionSpec],
  exports: [ClaimsService],
})
export class ClaimsModule implements OnModuleInit {
  constructor(
    private readonly registry: ExtractionRegistry,
    private readonly claimDocumentSpec: ClaimDocumentExtractionSpec,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.claimDocumentSpec);
  }
}
