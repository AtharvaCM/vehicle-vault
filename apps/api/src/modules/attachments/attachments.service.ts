import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentKind, type Attachment } from '@vehicle-vault/shared';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import {
  ATTACHMENTS_ALLOWED_MIME_TYPES,
  getUploadsDirectory,
} from './constants/attachment.constants';
import type { AttachmentUploadFile } from './types/attachment-upload-file.type';
import {
  buildStoredFileName,
  deleteStoredAttachmentFile,
  ensureUploadsDirectory,
  getAttachmentAbsolutePath,
} from './utils/attachment-upload.util';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceService: MaintenanceService,
  ) {
    ensureUploadsDirectory();
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
    const filePath = getAttachmentAbsolutePath(attachment.fileName);

    try {
      await access(filePath);
    } catch {
      throw new NotFoundException(`Attachment file for ${attachmentId} was not found on disk`);
    }

    return {
      ...this.toAttachment(attachment),
      filePath,
    };
  }

  async uploadAttachments(userId: string, recordId: string, files: AttachmentUploadFile[]) {
    await this.maintenanceService.getRecordById(userId, recordId);

    if (!files.length) {
      throw new BadRequestException('Add at least one attachment to upload.');
    }

    await mkdir(getUploadsDirectory(), { recursive: true });

    const preparedFiles = files.map((file) => {
      this.validateUploadedFile(file);

      const id = randomUUID();
      const fileName = buildStoredFileName(file.originalname);
      const filePath = getAttachmentAbsolutePath(fileName);

      return {
        id,
        maintenanceRecordId: recordId,
        kind: this.getAttachmentKind(file.mimetype),
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/api/attachments/${id}/file`,
        uploadedAt: new Date(),
        filePath,
        buffer: file.buffer,
      };
    });

    try {
      for (const file of preparedFiles) {
        await writeFile(file.filePath, file.buffer);
      }
    } catch (error) {
      await Promise.all(preparedFiles.map((file) => unlink(file.filePath).catch(() => undefined)));
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
      await Promise.all(preparedFiles.map((file) => unlink(file.filePath).catch(() => undefined)));
      throw error;
    }
  }

  async deleteAttachment(userId: string, attachmentId: string) {
    const attachment = await this.getStoredAttachmentById(userId, attachmentId);

    await this.prisma.attachment.delete({
      where: {
        id: attachmentId,
      },
    });
    await deleteStoredAttachmentFile(attachment.fileName);

    return {
      id: attachment.id,
      deleted: true,
    };
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

  private validateUploadedFile(file: AttachmentUploadFile) {
    if (
      !ATTACHMENTS_ALLOWED_MIME_TYPES.some((allowedMimeType) => allowedMimeType === file.mimetype)
    ) {
      throw new BadRequestException(
        'Unsupported file type. Allowed types: JPEG, PNG, WEBP, and PDF.',
      );
    }
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
