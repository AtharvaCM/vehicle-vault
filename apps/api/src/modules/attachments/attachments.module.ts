import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { AttachmentExtractionService } from './attachment-extraction.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [MaintenanceModule, AuditModule],
  controllers: [AttachmentsController],
  providers: [AttachmentExtractionService, AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
