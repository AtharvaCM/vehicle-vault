import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentKind, type Attachment } from '@vehicle-vault/shared';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { MaintenanceService } from '../maintenance/maintenance.service';
import {
  ATTACHMENTS_ALLOWED_MIME_TYPES,
  getUploadsDirectory,
} from './constants/attachment.constants';
import type { AttachmentRecord } from './types/attachment-record.type';
import type { AttachmentUploadFile } from './types/attachment-upload-file.type';
import { buildStoredFileName, ensureUploadsDirectory } from './utils/attachment-upload.util';

@Injectable()
export class AttachmentsService {
  private readonly attachments: AttachmentRecord[] = [];

  constructor(private readonly maintenanceService: MaintenanceService) {
    ensureUploadsDirectory();
  }

  listByMaintenanceRecord(recordId: string) {
    this.maintenanceService.getRecordById(recordId);

    return this.attachments
      .filter((item) => item.maintenanceRecordId === recordId)
      .sort(
        (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
      )
      .map((item) => this.toPublicAttachment(item));
  }

  getAttachmentById(attachmentId: string) {
    return this.toPublicAttachment(this.getStoredAttachmentById(attachmentId));
  }

  async getAttachmentFile(attachmentId: string) {
    const attachment = this.getStoredAttachmentById(attachmentId);

    try {
      await access(attachment.filePath);
    } catch {
      throw new NotFoundException(`Attachment file for ${attachmentId} was not found on disk`);
    }

    return attachment;
  }

  async uploadAttachments(recordId: string, files: AttachmentUploadFile[]) {
    this.maintenanceService.getRecordById(recordId);

    if (!files.length) {
      throw new BadRequestException('Add at least one attachment to upload.');
    }

    const uploadsDirectory = getUploadsDirectory();
    await mkdir(uploadsDirectory, { recursive: true });

    const storedAttachments = await Promise.all(
      files.map(async (file) => {
        this.validateUploadedFile(file);

        const storedFileName = buildStoredFileName(file.originalname);
        const absoluteFilePath = resolve(uploadsDirectory, storedFileName);

        await writeFile(absoluteFilePath, file.buffer);

        const attachment: AttachmentRecord = {
          id: randomUUID(),
          maintenanceRecordId: recordId,
          kind: this.getAttachmentKind(file.mimetype),
          fileName: storedFileName,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: '',
          uploadedAt: new Date().toISOString(),
          filePath: absoluteFilePath,
        };

        attachment.url = `/api/attachments/${attachment.id}/file`;
        this.attachments.unshift(attachment);

        return this.toPublicAttachment(attachment);
      }),
    );

    return storedAttachments;
  }

  async deleteAttachment(attachmentId: string) {
    const index = this.attachments.findIndex((item) => item.id === attachmentId);

    if (index === -1) {
      throw new NotFoundException(`Attachment ${attachmentId} was not found`);
    }

    const attachment = this.attachments[index];

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} was not found`);
    }

    this.attachments.splice(index, 1);

    try {
      await unlink(attachment.filePath);
    } catch (error) {
      const fileDeletionError = error as NodeJS.ErrnoException;

      if (fileDeletionError.code !== 'ENOENT') {
        throw fileDeletionError;
      }
    }

    return {
      id: attachment.id,
      deleted: true,
    };
  }

  private getStoredAttachmentById(attachmentId: string) {
    const attachment = this.attachments.find((item) => item.id === attachmentId);

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

  private toPublicAttachment(attachment: AttachmentRecord): Attachment {
    return {
      id: attachment.id,
      maintenanceRecordId: attachment.maintenanceRecordId,
      kind: attachment.kind,
      fileName: attachment.fileName,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      uploadedAt: attachment.uploadedAt,
    };
  }
}
