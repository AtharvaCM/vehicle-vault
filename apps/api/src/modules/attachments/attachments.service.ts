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

const MAINTENANCE_EXTRACTION_KIND = 'maintenance_invoice';

type PersistableExtraction = Omit<
  AttachmentExtraction,
  'attachmentId' | 'createdAt' | 'id' | 'status' | 'updatedAt'
>;

function toPersistable(
  result: { provider: string; extractedAt: string; data: MaintenanceInvoiceExtractionDraft },
): PersistableExtraction {
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

const attachmentInclude = {
  extraction: true,
} satisfies Prisma.AttachmentInclude;

type AttachmentWithExtraction = Prisma.AttachmentGetPayload<{
  include: typeof attachmentInclude;
}>;

type StoredAttachmentExtraction = Prisma.AttachmentExtractionGetPayload<Record<string, never>>;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceService: MaintenanceService,
    private readonly storageService: SupabaseStorageService,
    private readonly extractionService: ExtractionService,
    private readonly auditService: AuditService,
    private readonly vehicleLoansService: VehicleLoansService,
  ) {}

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
          vehicle: {
            userId,
          },
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
    if (!files.length) {
      throw new BadRequestException('Add at least one attachment to upload.');
    }

    const preparedFiles = await Promise.all(
      files.map(async (file) => {
        const preparedFile = await convertHeicToJpegIfNeeded(file);
        const id = randomUUID();
        const fileName = buildStoredAttachmentPath(
          userId,
          loanId,
          preparedFile.originalFileName,
          preparedFile.storageExtension,
        );
        return {
          id,
          vehicleLoanId: loanId,
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
              vehicleLoanId: file.vehicleLoanId,
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
          {
            buffer: fileBuffer,
            mimeType: attachment.mimeType,
            name: attachment.originalFileName,
          },
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
          vehicle: {
            userId,
          },
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
        orderedAttachments.map(async (attachment) => ({
          buffer: await this.storageService.downloadObject(attachment.fileName),
          mimeType: attachment.mimeType,
          name: attachment.originalFileName,
        })),
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

    return this.maintenanceService.updateRecord(
      userId,
      attachment.maintenanceRecordId,
      updatePayload,
    );
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

    await this.storageService.deleteObject(attachment.fileName);

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id: attachmentId } });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
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
          vehicle: {
            userId,
          },
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
            vehicle: {
              userId,
            },
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
          { maintenanceRecord: { vehicle: { userId } } },
          { vehicleLoan: { vehicle: { userId } } },
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
    if (!attachment.maintenanceRecordId && !attachment.vehicleLoanId) {
      throw new Error(
        `Cannot map attachment ${attachment.id}: no supported owner (expected maintenance record or vehicle loan).`,
      );
    }
    return {
      id: attachment.id,
      maintenanceRecordId: attachment.maintenanceRecordId ?? undefined,
      vehicleLoanId: attachment.vehicleLoanId ?? undefined,
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
    const breakdown = this.getLineItemBreakdown(lineItems);
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
      lineItems: lineItems.length ? lineItems : undefined,
    };

    return Object.fromEntries(
      Object.entries(updatePayload).filter(([, value]) => value !== undefined),
    ) as UpdateMaintenanceRecordInput;
  }

  private getLineItemBreakdown(lineItems: NonNullable<UpdateMaintenanceRecordInput['lineItems']>) {
    return lineItems.reduce(
      (totals, lineItem) => {
        const amount =
          typeof lineItem.lineTotal === 'number'
            ? lineItem.lineTotal
            : typeof lineItem.quantity === 'number' && typeof lineItem.unitPrice === 'number'
              ? lineItem.quantity * lineItem.unitPrice
              : 0;

        switch (lineItem.kind) {
          case 'labor':
            totals.laborCost += amount;
            totals.totalCost += amount;
            break;
          case 'part':
            totals.partsCost += amount;
            totals.totalCost += amount;
            break;
          case 'fluid':
            totals.fluidsCost += amount;
            totals.totalCost += amount;
            break;
          case 'tax':
            totals.taxCost += amount;
            totals.totalCost += amount;
            break;
          case 'discount':
            totals.discountAmount += amount;
            totals.totalCost -= amount;
            break;
          default:
            totals.totalCost += amount;
            break;
        }

        return totals;
      },
      {
        totalCost: 0,
        laborCost: 0,
        partsCost: 0,
        fluidsCost: 0,
        taxCost: 0,
        discountAmount: 0,
      },
    );
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
        quantity: typeof jsonItem.quantity === 'number' ? jsonItem.quantity : undefined,
        unit: typeof jsonItem.unit === 'string' ? jsonItem.unit : undefined,
        unitPrice: typeof jsonItem.unitPrice === 'number' ? jsonItem.unitPrice : undefined,
        lineTotal: typeof jsonItem.lineTotal === 'number' ? jsonItem.lineTotal : undefined,
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
