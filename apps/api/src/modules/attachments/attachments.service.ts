import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AttachmentKind,
  type Attachment,
  type AttachmentReconciliationSummary,
} from '@vehicle-vault/shared';
import { randomUUID } from 'node:crypto';

import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import type { AttachmentUploadFile } from './types/attachment-upload-file.type';
import {
  buildStoredAttachmentPath,
  validateAttachmentUploadFile,
} from './utils/attachment-upload.util';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceService: MaintenanceService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async listAllAttachments(userId: string) {
    const attachments = await this.prisma.attachment.findMany({
      where: {
        maintenanceRecord: {
          vehicle: {
            userId,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return attachments.map((attachment) => this.toAttachment(attachment));
  }

  async listByMaintenanceRecord(userId: string, recordId: string) {
    await this.maintenanceService.getRecordById(userId, recordId);
    const attachments = await this.prisma.attachment.findMany({
      where: {
        maintenanceRecordId: recordId,
      },
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

    const preparedFiles = files.map((file) => {
      const originalFileName = validateAttachmentUploadFile(file);
      const id = randomUUID();
      const fileName = buildStoredAttachmentPath(userId, recordId, originalFileName);

      return {
        id,
        maintenanceRecordId: recordId,
        kind: this.getAttachmentKind(file.mimetype),
        fileName,
        originalFileName,
        mimeType: file.mimetype,
        size: file.size,
        url: `/api/attachments/${id}/file`,
        uploadedAt: new Date(),
        buffer: file.buffer,
      };
    });

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
      const attachments = await this.prisma.$transaction(
        preparedFiles.map((file) =>
          this.prisma.attachment.create({
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
          }),
        ),
      );

      return attachments.map((attachment) => this.toAttachment(attachment));
    } catch (error) {
      await this.cleanupUploadedObjects(uploadedPaths);
      throw error;
    }
  }

  async deleteAttachment(userId: string, attachmentId: string) {
    const attachment = await this.getStoredAttachmentById(userId, attachmentId);

    await this.storageService.deleteObject(attachment.fileName);

    await this.prisma.attachment.delete({
      where: {
        id: attachmentId,
      },
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
    await Promise.all(paths.map((path) => this.storageService.deleteObject(path).catch(() => undefined)));
  }

  private async getStoredAttachmentById(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        maintenanceRecord: {
          vehicle: {
            userId,
          },
        },
      },
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

  private toAttachment(
    attachment: Prisma.AttachmentUncheckedCreateInput &
      Prisma.AttachmentUncheckedUpdateInput & {
        id: string;
        maintenanceRecordId: string;
        fileName: string;
        originalFileName: string;
        mimeType: string;
        size: number;
        url: string;
        uploadedAt: Date;
      },
  ) {
    return {
      id: attachment.id,
      maintenanceRecordId: attachment.maintenanceRecordId,
      kind: attachment.kind as AttachmentKind,
      fileName: attachment.fileName,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      uploadedAt: attachment.uploadedAt.toISOString(),
    } satisfies Attachment;
  }
}
