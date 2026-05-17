import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Attachment as AttachmentRow } from '@prisma/client';
import {
  AttachmentKind,
  ClaimAttachmentSchema,
  type ClaimAttachment,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import type { AttachmentUploadFile } from '../attachments/types/attachment-upload-file.type';
import { validateAttachmentUploadFile } from '../attachments/utils/attachment-upload.util';

function buildStoredClaimAttachmentPath(
  userId: string,
  claimId: string,
  originalFileName: string,
): string {
  return `claim-attachments/${userId}/${claimId}/${randomUUID()}${extname(originalFileName)}`;
}

function getAttachmentKind(mimeType: string): AttachmentKind {
  if (mimeType === 'application/pdf') return AttachmentKind.Document;
  if (mimeType.startsWith('image/')) return AttachmentKind.Image;
  return AttachmentKind.Other;
}

function toClaimAttachment(row: AttachmentRow): ClaimAttachment {
  if (!row.claimId) {
    throw new Error(`Cannot map attachment ${row.id}: not linked to a claim.`);
  }
  return ClaimAttachmentSchema.parse({
    id: row.id,
    claimId: row.claimId,
    kind: row.kind,
    fileName: row.fileName,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    size: row.size,
    url: row.url,
    uploadedAt: row.uploadedAt.toISOString(),
  });
}

@Injectable()
export class ClaimAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async listByClaim(userId: string, claimId: string): Promise<ClaimAttachment[]> {
    await this.ensureClaimOwnedBy(userId, claimId);
    const rows = await this.prisma.attachment.findMany({
      where: { claimId },
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map(toClaimAttachment);
  }

  async upload(
    userId: string,
    claimId: string,
    files: AttachmentUploadFile[],
  ): Promise<ClaimAttachment[]> {
    await this.ensureClaimOwnedBy(userId, claimId);

    if (!files.length) {
      throw new BadRequestException('Add at least one attachment to upload.');
    }

    const preparedFiles = files.map((file) => {
      const originalFileName = validateAttachmentUploadFile(file);
      const id = randomUUID();
      const fileName = buildStoredClaimAttachmentPath(userId, claimId, originalFileName);

      return {
        id,
        claimId,
        kind: getAttachmentKind(file.mimetype),
        fileName,
        originalFileName,
        mimeType: file.mimetype,
        size: file.size,
        url: `/api/claim-attachments/${id}/file`,
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
      const rows = await this.prisma.$transaction(
        preparedFiles.map((file) =>
          this.prisma.attachment.create({
            data: {
              id: file.id,
              claimId: file.claimId,
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
      return rows.map(toClaimAttachment);
    } catch (error) {
      await this.cleanupUploadedObjects(uploadedPaths);
      throw error;
    }
  }

  async getFile(userId: string, attachmentId: string) {
    const attachment = await this.getOwnedAttachment(userId, attachmentId);
    const fileBuffer = await this.storageService.downloadObject(attachment.fileName);
    return {
      ...toClaimAttachment(attachment),
      fileBuffer,
    };
  }

  async remove(userId: string, attachmentId: string) {
    const attachment = await this.getOwnedAttachment(userId, attachmentId);
    await this.storageService.deleteObject(attachment.fileName);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    return { id: attachmentId, deleted: true };
  }

  private async ensureClaimOwnedBy(userId: string, claimId: string): Promise<void> {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      select: {
        insurancePolicy: { select: { vehicle: { select: { userId: true } } } },
      },
    });
    if (!claim || claim.insurancePolicy.vehicle.userId !== userId) {
      throw new NotFoundException('Claim not found');
    }
  }

  private async getOwnedAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        claim: {
          insurancePolicy: { vehicle: { userId } },
        },
      },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} was not found`);
    }
    return attachment;
  }

  private async cleanupUploadedObjects(paths: string[]) {
    await Promise.all(
      paths.map((path) => this.storageService.deleteObject(path).catch(() => undefined)),
    );
  }
}
