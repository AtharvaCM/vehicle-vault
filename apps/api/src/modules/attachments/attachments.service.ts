import { AuditResourceType, Prisma } from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  AttachmentExtractionStatus,
  AttachmentKind,
  type AttachmentExtraction,
  type Attachment,
  type AttachmentReconciliationSummary,
  type MaintenanceFillPlan,
  type MaintenanceFillResult,
  type MaintenanceInvoiceExtractionDraft,
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
  type UpdateMaintenanceRecordInput,
} from '@vehicle-vault/shared';
import { randomUUID } from 'node:crypto';

import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { ExtractionService } from '../extraction/extraction.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { VehicleLoansService } from '../vehicle-loans/vehicle-loans.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import { getLineItemBreakdown, planMaintenanceFill } from './maintenance-fill';

const MAINTENANCE_EXTRACTION_KIND = 'maintenance_invoice';

type PersistableExtraction = Omit<
  AttachmentExtraction,
  'attachmentId' | 'createdAt' | 'id' | 'status' | 'updatedAt'
>;

function toPersistable(result: {
  provider: string;
  extractedAt: string;
  data: MaintenanceInvoiceExtractionDraft;
}): PersistableExtraction {
  return {
    provider: result.provider,
    extractedAt: result.extractedAt,
    failureReason: undefined,
    ...result.data,
  };
}
import type { AttachmentUploadFile } from './types/attachment-upload-file.type';
import {
  buildStoredAttachmentPath,
  convertHeicToJpegIfNeeded,
} from './utils/attachment-upload.util';
import { normalizeExtractionImageOrientation } from './utils/image-orientation.util';

const attachmentInclude = {
  extraction: true,
} satisfies Prisma.AttachmentInclude;

type AttachmentWithExtraction = Prisma.AttachmentGetPayload<{
  include: typeof attachmentInclude;
}>;

type StoredAttachmentExtraction = Prisma.AttachmentExtractionGetPayload<Record<string, never>>;

/** Every vehicle document kind can own its files. */
export type DocumentAttachmentKind = 'insurance' | 'warranty' | 'registration' | 'puc' | 'road_tax';

/** Which Attachment column holds the owner, for each way an attachment is stored. */
type AttachmentOwnerColumn =
  | { vehicleLoanId: string }
  | { insurancePolicyId: string }
  | { warrantyId: string }
  | { complianceDocumentId: string }
  | { accessoryId: string };

function documentOwnerColumn(
  kind: DocumentAttachmentKind,
  documentId: string,
): AttachmentOwnerColumn {
  if (kind === 'insurance') return { insurancePolicyId: documentId };
  if (kind === 'warranty') return { warrantyId: documentId };
  // Registration, PUC and road tax share one table, told apart by its kind column.
  return { complianceDocumentId: documentId };
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceService: MaintenanceService,
    private readonly storageService: SupabaseStorageService,
    private readonly extractionService: ExtractionService,
    private readonly auditService: AuditService,
    private readonly vehicleLoansService: VehicleLoansService,
    private readonly access: VehicleAccessService,
  ) {}

  private async assertEditorOnMaintenanceRecord(userId: string, recordId: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { id: recordId },
      select: { vehicleId: true },
    });
    if (!record) throw new BadRequestException('Maintenance record not found');
    await this.access.assertEditor(userId, record.vehicleId);
  }

  /** As resolveDocumentVehicle, for a compliance row reached from its file rather than a route. */
  private async resolveComplianceVehicle(documentId: string) {
    const document = await this.prisma.complianceDocument.findUnique({
      where: { id: documentId },
      select: { kind: true },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} was not found`);
    }
    return this.resolveDocumentVehicle(document.kind, documentId);
  }

  /**
   * The vehicle a document belongs to, and that vehicle's owner, whose
   * trail the audit event belongs in. Access is then the vehicle's: any member
   * may open a document's files, only an editor may add or remove them.
   */
  private async resolveDocumentVehicle(kind: DocumentAttachmentKind, documentId: string) {
    const select = { vehicleId: true, vehicle: { select: { userId: true } } } as const;
    const document =
      kind === 'insurance'
        ? await this.prisma.insurancePolicy.findUnique({ where: { id: documentId }, select })
        : kind === 'warranty'
          ? await this.prisma.warranty.findUnique({ where: { id: documentId }, select })
          : // A compliance row answers only to its own kind: a PUC is not
            // reachable as a registration.
            await this.prisma.complianceDocument.findFirst({
              where: { id: documentId, kind },
              select,
            });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} was not found`);
    }
    return { vehicleId: document.vehicleId, vehicleOwnerId: document.vehicle.userId };
  }

  getExtractionStatus() {
    return {
      available:
        this.extractionService.isAvailable &&
        this.extractionService.hasKind(MAINTENANCE_EXTRACTION_KIND),
    };
  }

  private get extractionAvailable(): boolean {
    return (
      this.extractionService.isAvailable &&
      this.extractionService.hasKind(MAINTENANCE_EXTRACTION_KIND)
    );
  }

  async listAllAttachments(userId: string) {
    const attachments = await this.prisma.attachment.findMany({
      where: {
        maintenanceRecord: {
          vehicle: { members: { some: { userId } } },
        },
      },
      include: attachmentInclude,
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return attachments.map((attachment) => this.toAttachment(attachment));
  }

  async listByVehicleLoan(userId: string, loanId: string) {
    await this.vehicleLoansService.getById(userId, loanId);
    const attachments = await this.prisma.attachment.findMany({
      where: { vehicleLoanId: loanId },
      include: attachmentInclude,
      orderBy: { uploadedAt: 'desc' },
    });
    return attachments.map((attachment) => this.toAttachment(attachment));
  }

  async uploadLoanAttachments(userId: string, loanId: string, files: AttachmentUploadFile[]) {
    await this.vehicleLoansService.getById(userId, loanId);
    return this.storeAttachments(userId, { vehicleLoanId: loanId }, loanId, userId, files);
  }

  /**
   * An accessory's receipt: any member of its vehicle may open it, only an
   * editor may add one, and the audit event goes to the vehicle owner's trail.
   */
  private async resolveAccessoryVehicle(accessoryId: string) {
    const accessory = await this.prisma.accessory.findUnique({
      where: { id: accessoryId },
      select: { vehicleId: true, vehicle: { select: { userId: true } } },
    });
    if (!accessory) {
      throw new NotFoundException(`Accessory ${accessoryId} was not found`);
    }
    return { vehicleId: accessory.vehicleId, vehicleOwnerId: accessory.vehicle.userId };
  }

  async listByAccessory(userId: string, accessoryId: string) {
    const { vehicleId } = await this.resolveAccessoryVehicle(accessoryId);
    await this.access.assert(userId, vehicleId);
    const attachments = await this.prisma.attachment.findMany({
      where: { accessoryId },
      include: attachmentInclude,
      orderBy: { uploadedAt: 'desc' },
    });
    return attachments.map((attachment) => this.toAttachment(attachment));
  }

  async uploadAccessoryAttachments(
    userId: string,
    accessoryId: string,
    files: AttachmentUploadFile[],
  ) {
    const { vehicleId, vehicleOwnerId } = await this.resolveAccessoryVehicle(accessoryId);
    await this.access.assertEditor(userId, vehicleId);
    return this.storeAttachments(userId, { accessoryId }, accessoryId, vehicleOwnerId, files);
  }

  async listByDocument(userId: string, kind: DocumentAttachmentKind, documentId: string) {
    const { vehicleId } = await this.resolveDocumentVehicle(kind, documentId);
    await this.access.assert(userId, vehicleId);
    const attachments = await this.prisma.attachment.findMany({
      where: documentOwnerColumn(kind, documentId),
      include: attachmentInclude,
      orderBy: { uploadedAt: 'desc' },
    });
    return attachments.map((attachment) => this.toAttachment(attachment));
  }

  async uploadDocumentAttachments(
    userId: string,
    kind: DocumentAttachmentKind,
    documentId: string,
    files: AttachmentUploadFile[],
  ) {
    const { vehicleId, vehicleOwnerId } = await this.resolveDocumentVehicle(kind, documentId);
    await this.access.assertEditor(userId, vehicleId);
    return this.storeAttachments(
      userId,
      documentOwnerColumn(kind, documentId),
      documentId,
      vehicleOwnerId,
      files,
    );
  }

  /**
   * Uploads the files, then records them in one audited transaction. Storage
   * goes first so a row never points at a file that is not there; if either
   * step fails, what was uploaded is removed again. Files live under the
   * uploader's own prefix, `attachments/<userId>/<ownerId>/`, which is what
   * account deletion sweeps.
   */
  private async storeAttachments(
    userId: string,
    owner: AttachmentOwnerColumn,
    ownerId: string,
    auditOwnerUserId: string,
    files: AttachmentUploadFile[],
  ) {
    if (!files.length) {
      throw new BadRequestException('Add at least one attachment to upload.');
    }

    const preparedFiles = await Promise.all(
      files.map(async (file) => {
        const preparedFile = await convertHeicToJpegIfNeeded(file);
        const id = randomUUID();
        const fileName = buildStoredAttachmentPath(
          userId,
          ownerId,
          preparedFile.originalFileName,
          preparedFile.storageExtension,
        );
        return {
          id,
          kind: this.getAttachmentKind(preparedFile.mimeType),
          fileName,
          originalFileName: preparedFile.originalFileName,
          mimeType: preparedFile.mimeType,
          size: preparedFile.size,
          url: `/api/attachments/${id}/file`,
          uploadedAt: new Date(),
          buffer: preparedFile.buffer,
        };
      }),
    );

    const uploadedPaths: string[] = [];
    try {
      for (const file of preparedFiles) {
        await this.storageService.uploadObject(file.fileName, file.buffer, file.mimeType);
        uploadedPaths.push(file.fileName);
      }
    } catch (error) {
      await this.cleanupUploadedObjects(uploadedPaths);
      throw error;
    }

    try {
      const attachments = await this.prisma.$transaction(async (tx) => {
        const created = [];
        for (const file of preparedFiles) {
          const row = await tx.attachment.create({
            data: {
              id: file.id,
              ...owner,
              kind: file.kind,
              fileName: file.fileName,
              originalFileName: file.originalFileName,
              mimeType: file.mimeType,
              size: file.size,
              url: file.url,
              uploadedAt: file.uploadedAt,
            },
            include: attachmentInclude,
          });
          await this.auditService.track(tx, {
            actorUserId: userId,
            ownerUserId: auditOwnerUserId,
            action: AUDIT_ACTIONS.attachment.uploaded,
            resourceType: AuditResourceType.attachment,
            resourceId: row.id,
            after: row as unknown as Record<string, unknown>,
          });
          created.push(row);
        }
        return created;
      });
      return attachments.map((attachment) => this.toAttachment(attachment));
    } catch (error) {
      await this.cleanupUploadedObjects(uploadedPaths);
      throw error;
    }
  }

  async listByMaintenanceRecord(userId: string, recordId: string) {
    await this.maintenanceService.getRecordById(userId, recordId);
    const attachments = await this.prisma.attachment.findMany({
      where: {
        maintenanceRecordId: recordId,
      },
      include: attachmentInclude,
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return attachments.map((attachment) => this.toAttachment(attachment));
  }

  async getAttachmentById(userId: string, attachmentId: string) {
    const attachment = await this.getStoredAttachmentById(userId, attachmentId);

    return this.toAttachment(attachment);
  }

  async extractAttachment(userId: string, attachmentId: string) {
    if (!this.extractionAvailable) {
      throw new InternalServerErrorException(
        'DocumentExtraction service is not configured (missing GEMINI_API_KEY or unregistered kind).',
      );
    }

    const attachment = await this.getStoredAttachmentById(userId, attachmentId);
    if (!attachment.maintenanceRecordId) {
      // This reads every file as a service invoice, which only a maintenance
      // record can take: applyExtraction and fill refuse any other owner. A
      // vehicle document or loan is read as its own kind from an upload to its
      // scan route, so any other owner's file is refused here for every role,
      // before it is downloaded or the provider called. A non-member has
      // already had a 404 above.
      throw new BadRequestException('Only a file on a service record can be read as an invoice.');
    }
    // Opening a service file is for any member; extracting from it is an edit.
    // It costs a provider call and replaces the stored extraction, which only an
    // editor can go on to apply.
    await this.assertEditorOnMaintenanceRecord(userId, attachment.maintenanceRecordId);
    const fileBuffer = await this.storageService.downloadObject(attachment.fileName);

    await this.prisma.attachmentExtraction.upsert({
      where: {
        attachmentId: attachment.id,
      },
      create: {
        attachmentId: attachment.id,
        status: AttachmentExtractionStatus.Pending,
        provider: 'gemini',
      },
      update: {
        status: AttachmentExtractionStatus.Pending,
        provider: 'gemini',
        failureReason: null,
      },
    });

    try {
      const result = await this.extractionService.extract<MaintenanceInvoiceExtractionDraft>(
        MAINTENANCE_EXTRACTION_KIND,
        [
          normalizeExtractionImageOrientation({
            buffer: fileBuffer,
            mimeType: attachment.mimeType,
            name: attachment.originalFileName,
          }),
        ],
      );
      const extracted = toPersistable(result);
      const storedExtraction = await this.prisma.attachmentExtraction.upsert({
        where: {
          attachmentId: attachment.id,
        },
        create: this.toAttachmentExtractionCreateData(attachment.id, extracted),
        update: this.toAttachmentExtractionUpdateData(extracted),
      });

      return this.toAttachmentExtraction(storedExtraction);
    } catch (error) {
      await this.prisma.attachmentExtraction.upsert({
        where: {
          attachmentId: attachment.id,
        },
        create: {
          attachmentId: attachment.id,
          status: AttachmentExtractionStatus.Failed,
          provider: 'gemini',
          failureReason: this.getErrorMessage(error),
        },
        update: {
          status: AttachmentExtractionStatus.Failed,
          provider: 'gemini',
          failureReason: this.getErrorMessage(error),
        },
      });
      throw error;
    }
  }

  async extractAttachments(userId: string, recordId: string, attachmentIds: string[]) {
    if (!this.extractionAvailable) {
      throw new InternalServerErrorException(
        'DocumentExtraction service is not configured (missing GEMINI_API_KEY or unregistered kind).',
      );
    }

    await this.maintenanceService.getRecordById(userId, recordId);
    await this.assertEditorOnMaintenanceRecord(userId, recordId);

    const uniqueAttachmentIds = [...new Set(attachmentIds)];

    if (!uniqueAttachmentIds.length) {
      throw new BadRequestException('Select at least one attachment to extract.');
    }

    const attachments = await this.prisma.attachment.findMany({
      where: {
        id: {
          in: uniqueAttachmentIds,
        },
        maintenanceRecordId: recordId,
        maintenanceRecord: {
          vehicle: { members: { some: { userId } } },
        },
      },
      include: attachmentInclude,
    });

    if (attachments.length !== uniqueAttachmentIds.length) {
      throw new NotFoundException('One or more attachments were not found for this record.');
    }

    const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]));
    const orderedAttachments = uniqueAttachmentIds.map((id) => {
      const attachment = attachmentsById.get(id);

      if (!attachment) {
        throw new NotFoundException('One or more attachments were not found for this record.');
      }

      return attachment;
    });
    const [primaryAttachment] = orderedAttachments;

    if (!primaryAttachment) {
      throw new BadRequestException('Select at least one attachment to extract.');
    }

    await Promise.all(
      orderedAttachments.map((attachment) =>
        this.prisma.attachmentExtraction.upsert({
          where: {
            attachmentId: attachment.id,
          },
          create: {
            attachmentId: attachment.id,
            status: AttachmentExtractionStatus.Pending,
            provider: 'gemini',
          },
          update: {
            status: AttachmentExtractionStatus.Pending,
            provider: 'gemini',
            failureReason: null,
          },
        }),
      ),
    );

    try {
      const documents = await Promise.all(
        orderedAttachments.map(async (attachment) =>
          normalizeExtractionImageOrientation({
            buffer: await this.storageService.downloadObject(attachment.fileName),
            mimeType: attachment.mimeType,
            name: attachment.originalFileName,
          }),
        ),
      );

      const result = await this.extractionService.extract<MaintenanceInvoiceExtractionDraft>(
        MAINTENANCE_EXTRACTION_KIND,
        documents,
      );
      const extracted = toPersistable(result);
      const storedExtractions = await Promise.all(
        orderedAttachments.map((attachment) =>
          this.prisma.attachmentExtraction.upsert({
            where: {
              attachmentId: attachment.id,
            },
            create: this.toAttachmentExtractionCreateData(attachment.id, extracted),
            update: this.toAttachmentExtractionUpdateData(extracted),
          }),
        ),
      );
      const primaryExtraction = storedExtractions.find(
        (extraction) => extraction.attachmentId === primaryAttachment.id,
      );

      return this.toAttachmentExtraction(primaryExtraction ?? storedExtractions[0]!);
    } catch (error) {
      await Promise.all(
        orderedAttachments.map((attachment) =>
          this.prisma.attachmentExtraction.upsert({
            where: {
              attachmentId: attachment.id,
            },
            create: {
              attachmentId: attachment.id,
              status: AttachmentExtractionStatus.Failed,
              provider: 'gemini',
              failureReason: this.getErrorMessage(error),
            },
            update: {
              status: AttachmentExtractionStatus.Failed,
              provider: 'gemini',
              failureReason: this.getErrorMessage(error),
            },
          }),
        ),
      );
      throw error;
    }
  }

  /**
   * Writes a whole extraction into a draft: every field it read, over whatever
   * the draft held, and the record stays a draft for someone to confirm. A
   * confirmed record is refused — this would overwrite what was typed and turn
   * it back into a draft — and is filled in with `fillFromAttachment` instead.
   */
  async applyExtraction(userId: string, attachmentId: string) {
    const attachment = await this.getStoredAttachmentById(userId, attachmentId);
    const extraction = attachment.extraction
      ? this.toAttachmentExtraction(attachment.extraction)
      : undefined;

    if (!extraction || extraction.status !== AttachmentExtractionStatus.Completed) {
      throw new BadRequestException('Run extraction on this attachment before applying it.');
    }

    const updatePayload = this.buildMaintenanceUpdateFromExtraction(extraction);

    if (!Object.keys(updatePayload).length) {
      throw new BadRequestException('This extraction does not contain enough data to apply.');
    }

    if (!attachment.maintenanceRecordId) {
      throw new BadRequestException(
        'This attachment is not linked to a maintenance record and cannot apply extractions.',
      );
    }

    const record = await this.maintenanceService.getRecordById(
      userId,
      attachment.maintenanceRecordId,
    );
    if (record.status === MaintenanceRecordStatus.Confirmed) {
      throw new BadRequestException(
        'This record is confirmed, so an extraction only fills in what it is missing. Use Fill in from photo on the record instead.',
      );
    }

    return this.maintenanceService.updateRecord(
      userId,
      attachment.maintenanceRecordId,
      updatePayload,
    );
  }

  /** What filling the record in from this attachment would write; changes nothing. */
  async getFillPlan(userId: string, attachmentId: string): Promise<MaintenanceFillPlan> {
    const { record, extraction } = await this.getFillSource(userId, attachmentId);
    return planMaintenanceFill(record, extraction);
  }

  /**
   * "Fill in from photo": writes what the attachment's extraction read into the
   * fields its confirmed record leaves blank, and nothing else (see
   * `planMaintenanceFill`). The record stays confirmed. The write is an ordinary
   * record update, so it is validated, audited as `maintenance.updated` in its
   * own transaction, and a next-due it fills makes the record's reminder.
   */
  async fillFromAttachment(userId: string, attachmentId: string): Promise<MaintenanceFillResult> {
    const { record, extraction } = await this.getFillSource(userId, attachmentId);
    const plan = planMaintenanceFill(record, extraction);

    if (!plan.fields.length) {
      return { record, filledFields: [] };
    }

    const updated = await this.maintenanceService.updateRecord(userId, record.id, plan.changes);
    return { record: updated, filledFields: plan.fields };
  }

  /**
   * The confirmed record an attachment belongs to and the extraction read from
   * it. Filling a record in is an edit, so it takes an editor; extraction runs
   * only when someone asks for it, so this needs one that has finished.
   */
  private async getFillSource(userId: string, attachmentId: string) {
    const attachment = await this.getStoredAttachmentById(userId, attachmentId);

    if (!attachment.maintenanceRecordId) {
      throw new BadRequestException('Only a file on a service record can fill that record in.');
    }

    await this.assertEditorOnMaintenanceRecord(userId, attachment.maintenanceRecordId);

    const record = await this.maintenanceService.getRecordById(
      userId,
      attachment.maintenanceRecordId,
    );
    if (record.status !== MaintenanceRecordStatus.Confirmed) {
      throw new BadRequestException(
        'A draft takes the whole extraction: apply it to the draft instead.',
      );
    }

    if (attachment.extraction?.status !== AttachmentExtractionStatus.Completed) {
      throw new BadRequestException('Read this file first, then fill the record in from it.');
    }

    return { record, extraction: this.toAttachmentExtraction(attachment.extraction) };
  }

  async getAttachmentFile(userId: string, attachmentId: string) {
    const attachment = await this.getStoredAttachmentById(userId, attachmentId);
    const fileBuffer = await this.storageService.downloadObject(attachment.fileName);

    return {
      ...this.toAttachment(attachment),
      fileBuffer,
    };
  }

  async uploadAttachments(userId: string, recordId: string, files: AttachmentUploadFile[]) {
    await this.maintenanceService.getRecordById(userId, recordId);
    await this.assertEditorOnMaintenanceRecord(userId, recordId);

    if (!files.length) {
      throw new BadRequestException('Add at least one attachment to upload.');
    }

    const preparedFiles = await Promise.all(
      files.map(async (file) => {
        const preparedFile = await convertHeicToJpegIfNeeded(file);
        const id = randomUUID();
        const fileName = buildStoredAttachmentPath(
          userId,
          recordId,
          preparedFile.originalFileName,
          preparedFile.storageExtension,
        );

        return {
          id,
          maintenanceRecordId: recordId,
          kind: this.getAttachmentKind(preparedFile.mimeType),
          fileName,
          originalFileName: preparedFile.originalFileName,
          mimeType: preparedFile.mimeType,
          size: preparedFile.size,
          url: `/api/attachments/${id}/file`,
          uploadedAt: new Date(),
          buffer: preparedFile.buffer,
        };
      }),
    );

    const uploadedPaths: string[] = [];

    try {
      for (const file of preparedFiles) {
        await this.storageService.uploadObject(file.fileName, file.buffer, file.mimeType);
        uploadedPaths.push(file.fileName);
      }
    } catch (error) {
      await this.cleanupUploadedObjects(uploadedPaths);
      throw error;
    }

    try {
      const attachments = await this.prisma.$transaction(async (tx) => {
        const created = [];
        for (const file of preparedFiles) {
          const row = await tx.attachment.create({
            data: {
              id: file.id,
              maintenanceRecordId: file.maintenanceRecordId,
              kind: file.kind,
              fileName: file.fileName,
              originalFileName: file.originalFileName,
              mimeType: file.mimeType,
              size: file.size,
              url: file.url,
              uploadedAt: file.uploadedAt,
            },
            include: attachmentInclude,
          });
          await this.auditService.track(tx, {
            actorUserId: userId,
            ownerUserId: userId,
            action: AUDIT_ACTIONS.attachment.uploaded,
            resourceType: AuditResourceType.attachment,
            resourceId: row.id,
            after: row as unknown as Record<string, unknown>,
          });
          created.push(row);
        }
        return created;
      });

      return attachments.map((attachment) => this.toAttachment(attachment));
    } catch (error) {
      await this.cleanupUploadedObjects(uploadedPaths);
      throw error;
    }
  }

  async deleteAttachment(userId: string, attachmentId: string) {
    const attachment = await this.getStoredAttachmentById(userId, attachmentId);
    let auditOwnerUserId = userId;
    if (attachment.maintenanceRecordId) {
      await this.assertEditorOnMaintenanceRecord(userId, attachment.maintenanceRecordId);
    }
    // Loan attachments stay owner-only via the upstream getStoredAttachmentById filter.
    const documentOwner = attachment.insurancePolicyId
      ? await this.resolveDocumentVehicle('insurance', attachment.insurancePolicyId)
      : attachment.warrantyId
        ? await this.resolveDocumentVehicle('warranty', attachment.warrantyId)
        : attachment.complianceDocumentId
          ? await this.resolveComplianceVehicle(attachment.complianceDocumentId)
          : attachment.accessoryId
            ? await this.resolveAccessoryVehicle(attachment.accessoryId)
            : null;
    if (documentOwner) {
      // Opening is for any member; removing a file from a document is an edit.
      await this.access.assertEditor(userId, documentOwner.vehicleId);
      auditOwnerUserId = documentOwner.vehicleOwnerId;
    }

    await this.storageService.deleteObject(attachment.fileName);

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id: attachmentId } });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: auditOwnerUserId,
        action: AUDIT_ACTIONS.attachment.deleted,
        resourceType: AuditResourceType.attachment,
        resourceId: attachmentId,
        before: attachment as unknown as Record<string, unknown>,
      });
    });

    return {
      id: attachment.id,
      deleted: true,
    };
  }

  async reconcileAttachments(userId: string): Promise<AttachmentReconciliationSummary> {
    const attachments = await this.prisma.attachment.findMany({
      where: {
        maintenanceRecord: {
          vehicle: { members: { some: { userId } } },
        },
      },
      select: {
        id: true,
        fileName: true,
      },
    });

    const missingAttachmentIds: string[] = [];

    for (const attachment of attachments) {
      const exists = await this.storageService.objectExists(attachment.fileName);

      if (!exists) {
        missingAttachmentIds.push(attachment.id);
      }
    }

    if (missingAttachmentIds.length > 0) {
      await this.prisma.attachment.deleteMany({
        where: {
          id: {
            in: missingAttachmentIds,
          },
          maintenanceRecord: {
            vehicle: { members: { some: { userId } } },
          },
        },
      });
    }

    return {
      checkedCount: attachments.length,
      healthyCount: attachments.length - missingAttachmentIds.length,
      removedMissingMetadataCount: missingAttachmentIds.length,
      removedAttachmentIds: missingAttachmentIds,
    };
  }

  private async cleanupUploadedObjects(paths: string[]) {
    await Promise.all(
      paths.map((path) => this.storageService.deleteObject(path).catch(() => undefined)),
    );
  }

  private async getStoredAttachmentById(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        OR: [
          { maintenanceRecord: { vehicle: { members: { some: { userId } } } } },
          { vehicleLoan: { vehicle: { members: { some: { userId, role: 'owner' } } } } },
          // A document's files are the vehicle's: any member may open them.
          { insurancePolicy: { vehicle: { members: { some: { userId } } } } },
          { warranty: { vehicle: { members: { some: { userId } } } } },
          { complianceDocument: { vehicle: { members: { some: { userId } } } } },
          // An accessory's receipt is the vehicle's too.
          { accessory: { vehicle: { members: { some: { userId } } } } },
        ],
      },
      include: attachmentInclude,
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} was not found`);
    }

    return attachment;
  }

  private getAttachmentKind(mimeType: string) {
    if (mimeType === 'application/pdf') {
      return AttachmentKind.Document;
    }

    if (mimeType.startsWith('image/')) {
      return AttachmentKind.Image;
    }

    return AttachmentKind.Other;
  }

  private toAttachment(attachment: AttachmentWithExtraction) {
    if (
      !attachment.maintenanceRecordId &&
      !attachment.vehicleLoanId &&
      !attachment.insurancePolicyId &&
      !attachment.warrantyId &&
      !attachment.complianceDocumentId &&
      !attachment.accessoryId
    ) {
      throw new Error(
        `Cannot map attachment ${attachment.id}: no supported owner (expected a maintenance record, vehicle loan, vehicle document or accessory).`,
      );
    }
    return {
      id: attachment.id,
      maintenanceRecordId: attachment.maintenanceRecordId ?? undefined,
      vehicleLoanId: attachment.vehicleLoanId ?? undefined,
      insurancePolicyId: attachment.insurancePolicyId ?? undefined,
      warrantyId: attachment.warrantyId ?? undefined,
      complianceDocumentId: attachment.complianceDocumentId ?? undefined,
      accessoryId: attachment.accessoryId ?? undefined,
      kind: attachment.kind as AttachmentKind,
      fileName: attachment.fileName,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      uploadedAt: attachment.uploadedAt.toISOString(),
      ...(attachment.extraction
        ? { extraction: this.toAttachmentExtraction(attachment.extraction) }
        : {}),
    } satisfies Attachment;
  }

  private toAttachmentExtraction(
    storedExtraction: StoredAttachmentExtraction,
  ): AttachmentExtraction {
    return {
      id: storedExtraction.id,
      attachmentId: storedExtraction.attachmentId,
      status: storedExtraction.status as AttachmentExtractionStatus,
      provider: storedExtraction.provider ?? undefined,
      confidence:
        storedExtraction.confidence !== null ? Number(storedExtraction.confidence) : undefined,
      vendorName: storedExtraction.vendorName ?? undefined,
      workshopName: storedExtraction.workshopName ?? undefined,
      invoiceNumber: storedExtraction.invoiceNumber ?? undefined,
      documentDate: storedExtraction.documentDate?.toISOString(),
      serviceDate: storedExtraction.serviceDate?.toISOString(),
      odometer: storedExtraction.odometer ?? undefined,
      totalCost:
        storedExtraction.totalCost !== null ? Number(storedExtraction.totalCost) : undefined,
      currencyCode: storedExtraction.currencyCode ?? undefined,
      notes: storedExtraction.notes ?? undefined,
      lineItems: this.fromLineItemJsonValue(storedExtraction.lineItems),
      nextDueDate: storedExtraction.nextDueDate?.toISOString(),
      nextDueOdometer: storedExtraction.nextDueOdometer ?? undefined,
      failureReason: storedExtraction.failureReason ?? undefined,
      extractedAt: storedExtraction.extractedAt?.toISOString(),
      createdAt: storedExtraction.createdAt.toISOString(),
      updatedAt: storedExtraction.updatedAt.toISOString(),
    };
  }

  private toAttachmentExtractionCreateData(
    attachmentId: string,
    extraction: Omit<
      AttachmentExtraction,
      'attachmentId' | 'createdAt' | 'id' | 'status' | 'updatedAt'
    >,
  ) {
    return {
      attachmentId,
      status: AttachmentExtractionStatus.Completed,
      provider: extraction.provider,
      confidence: extraction.confidence,
      vendorName: extraction.vendorName,
      workshopName: extraction.workshopName,
      invoiceNumber: extraction.invoiceNumber,
      documentDate: extraction.documentDate ? new Date(extraction.documentDate) : undefined,
      serviceDate: extraction.serviceDate ? new Date(extraction.serviceDate) : undefined,
      odometer: extraction.odometer,
      totalCost: extraction.totalCost,
      currencyCode: extraction.currencyCode,
      notes: extraction.notes,
      lineItems: extraction.lineItems ? this.toJsonValue(extraction.lineItems) : undefined,
      nextDueDate: extraction.nextDueDate ? new Date(extraction.nextDueDate) : undefined,
      nextDueOdometer: extraction.nextDueOdometer,
      extractedAt: extraction.extractedAt ? new Date(extraction.extractedAt) : new Date(),
      failureReason: null,
    };
  }

  private toAttachmentExtractionUpdateData(
    extraction: Omit<
      AttachmentExtraction,
      'attachmentId' | 'createdAt' | 'id' | 'status' | 'updatedAt'
    >,
  ) {
    return {
      status: AttachmentExtractionStatus.Completed,
      provider: extraction.provider,
      confidence: extraction.confidence,
      vendorName: extraction.vendorName,
      workshopName: extraction.workshopName,
      invoiceNumber: extraction.invoiceNumber,
      documentDate: extraction.documentDate ? new Date(extraction.documentDate) : null,
      serviceDate: extraction.serviceDate ? new Date(extraction.serviceDate) : null,
      odometer: extraction.odometer,
      totalCost: extraction.totalCost,
      currencyCode: extraction.currencyCode,
      notes: extraction.notes,
      lineItems: extraction.lineItems ? this.toJsonValue(extraction.lineItems) : Prisma.JsonNull,
      nextDueDate: extraction.nextDueDate ? new Date(extraction.nextDueDate) : null,
      nextDueOdometer: extraction.nextDueOdometer ?? null,
      extractedAt: extraction.extractedAt ? new Date(extraction.extractedAt) : new Date(),
      failureReason: null,
    };
  }

  private buildMaintenanceUpdateFromExtraction(
    extraction: AttachmentExtraction,
  ): UpdateMaintenanceRecordInput {
    const lineItems =
      extraction.lineItems?.map((lineItem, index) => ({
        ...lineItem,
        position: index,
      })) ?? [];
    const breakdown = getLineItemBreakdown(lineItems);
    const primaryCategory = lineItems.find(
      (lineItem) => lineItem.normalizedCategory,
    )?.normalizedCategory;
    const totalCost = extraction.totalCost ?? (lineItems.length ? breakdown.totalCost : undefined);
    const updatePayload: UpdateMaintenanceRecordInput = {
      category: primaryCategory ?? (lineItems.length ? MaintenanceCategory.Other : undefined),
      serviceDate: extraction.serviceDate ?? extraction.documentDate,
      odometer: extraction.odometer,
      workshopName: extraction.workshopName ?? extraction.vendorName,
      invoiceNumber: extraction.invoiceNumber,
      currencyCode: extraction.currencyCode,
      source: MaintenanceSource.Ocr,
      status: MaintenanceRecordStatus.Draft,
      totalCost,
      laborCost: lineItems.length ? breakdown.laborCost : undefined,
      partsCost: lineItems.length ? breakdown.partsCost : undefined,
      fluidsCost: lineItems.length ? breakdown.fluidsCost : undefined,
      taxCost: lineItems.length ? breakdown.taxCost : undefined,
      discountAmount: lineItems.length ? breakdown.discountAmount : undefined,
      notes: extraction.notes,
      nextDueDate: extraction.nextDueDate,
      nextDueOdometer: extraction.nextDueOdometer,
      lineItems: lineItems.length ? lineItems : undefined,
    };

    return Object.fromEntries(
      Object.entries(updatePayload).filter(([, value]) => value !== undefined),
    ) as UpdateMaintenanceRecordInput;
  }

  private fromLineItemJsonValue(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const lineItems: NonNullable<AttachmentExtraction['lineItems']> = [];

    value.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return;
      }

      const jsonItem = item as Prisma.JsonObject;
      const kind =
        typeof jsonItem.kind === 'string'
          ? Object.values(MaintenanceLineItemKind).find((candidate) => candidate === jsonItem.kind)
          : undefined;
      const name = typeof jsonItem.name === 'string' ? jsonItem.name : undefined;

      if (!kind || !name) {
        return;
      }

      lineItems.push({
        kind,
        name,
        normalizedCategory:
          typeof jsonItem.normalizedCategory === 'string' &&
          Object.values(MaintenanceCategory).some(
            (candidate) => candidate === jsonItem.normalizedCategory,
          )
            ? (jsonItem.normalizedCategory as MaintenanceCategory)
            : undefined,
        quantity: toAmountMagnitude(jsonItem.quantity),
        unit: typeof jsonItem.unit === 'string' ? jsonItem.unit : undefined,
        unitPrice: toAmountMagnitude(jsonItem.unitPrice),
        lineTotal: toAmountMagnitude(jsonItem.lineTotal),
        brand: typeof jsonItem.brand === 'string' ? jsonItem.brand : undefined,
        partNumber: typeof jsonItem.partNumber === 'string' ? jsonItem.partNumber : undefined,
        notes: typeof jsonItem.notes === 'string' ? jsonItem.notes : undefined,
      });
    });

    return lineItems.length ? lineItems : undefined;
  }

  private toJsonValue(value: NonNullable<AttachmentExtraction['lineItems']>) {
    return value as Prisma.InputJsonValue;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Extraction failed.';
  }
}

/**
 * Line item amounts are magnitudes; the kind carries the sign. Extractions stored
 * before that was enforced can hold a negative discount, which fails validation on
 * the way into a maintenance record — so rows already on disk are coerced on read
 * rather than being left permanently unapplicable.
 */
function toAmountMagnitude(value: Prisma.JsonValue | undefined) {
  return typeof value === 'number' && !Number.isNaN(value) ? Math.abs(value) : undefined;
}
