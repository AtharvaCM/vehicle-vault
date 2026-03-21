import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentKind } from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { randomUuidMock } = vi.hoisted(() => ({
  randomUuidMock: vi.fn(),
}));

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');

  return {
    ...actual,
    randomUUID: randomUuidMock,
  };
});

import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  type AttachmentDelegateMock = {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    $transaction: ReturnType<typeof vi.fn>;
    attachment: AttachmentDelegateMock;
  };

  const uploadedAt = new Date('2026-03-20T00:00:00.000Z');

  const prisma: PrismaMock = {
    $transaction: vi.fn(),
    attachment: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const maintenanceService = {
    getRecordById: vi.fn().mockResolvedValue({
      id: 'record-1',
    }),
  };

  const storageService = {
    deleteObject: vi.fn(),
    downloadObject: vi.fn(),
    uploadObject: vi.fn(),
  };

  let service: AttachmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(uploadedAt);
    randomUuidMock.mockReturnValue('attachment-1');
    prisma.$transaction = vi.fn(async (operations: Array<Promise<unknown> | unknown>) =>
      Promise.all(operations),
    );
    prisma.attachment.create = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...data,
        uploadedAt: data.uploadedAt ?? uploadedAt,
      }),
    );

    storageService.deleteObject.mockResolvedValue(undefined);
    storageService.downloadObject.mockResolvedValue(Buffer.from(''));
    storageService.uploadObject.mockResolvedValue(undefined);

    service = new AttachmentsService(
      prisma as never,
      maintenanceService as never,
      storageService as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uploads attachment metadata and stores the file in cloud storage', async () => {
    const result = await service.uploadAttachments('user-1', 'record-1', [
      {
        originalname: 'receipt.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.7 test payload'),
      },
    ]);

    expect(maintenanceService.getRecordById).toHaveBeenCalledWith('user-1', 'record-1');
    expect(storageService.uploadObject).toHaveBeenCalledWith(
      'attachments/user-1/record-1/attachment-1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(result).toEqual([
      {
        id: 'attachment-1',
        maintenanceRecordId: 'record-1',
        kind: AttachmentKind.Document,
        fileName: 'attachments/user-1/record-1/attachment-1.pdf',
        originalFileName: 'receipt.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: '/api/attachments/attachment-1/file',
        uploadedAt: uploadedAt.toISOString(),
      },
    ]);
  });

  it('rejects uploads without files', async () => {
    await expect(service.uploadAttachments('user-1', 'record-1', [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects empty uploads', async () => {
    await expect(
      service.uploadAttachments('user-1', 'record-1', [
        {
          originalname: 'receipt.pdf',
          mimetype: 'application/pdf',
          size: 0,
          buffer: Buffer.alloc(0),
        },
      ]),
    ).rejects.toMatchObject({
      message: 'Uploaded files cannot be empty.',
    });
  });

  it('sanitizes original file names before storing metadata', async () => {
    const result = await service.uploadAttachments('user-1', 'record-1', [
      {
        originalname: '../../receipt.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.7 test payload'),
      },
    ]);

    expect(storageService.uploadObject).toHaveBeenCalledWith(
      'attachments/user-1/record-1/attachment-1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(result[0]?.originalFileName).toBe('receipt.pdf');
  });

  it('rolls back uploaded objects when metadata persistence fails', async () => {
    prisma.attachment.create = vi.fn().mockRejectedValue(new Error('db failed'));

    await expect(
      service.uploadAttachments('user-1', 'record-1', [
        {
          originalname: 'receipt.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('%PDF-1.7 test payload'),
        },
      ]),
    ).rejects.toThrow('db failed');

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'attachments/user-1/record-1/attachment-1.pdf',
    );
  });

  it('returns not found when the stored attachment object is missing', async () => {
    prisma.attachment.findFirst = vi.fn().mockResolvedValue({
      id: 'attachment-1',
      maintenanceRecordId: 'record-1',
      kind: AttachmentKind.Document,
      fileName: 'attachments/user-1/record-1/attachment-1.pdf',
      originalFileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      url: '/api/attachments/attachment-1/file',
      uploadedAt,
    });
    storageService.downloadObject.mockRejectedValue(
      new NotFoundException('Attachment file attachment-1 was not found in cloud storage.'),
    );

    await expect(service.getAttachmentFile('user-1', 'attachment-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the file buffer for cloud-backed attachments', async () => {
    prisma.attachment.findFirst = vi.fn().mockResolvedValue({
      id: 'attachment-1',
      maintenanceRecordId: 'record-1',
      kind: AttachmentKind.Document,
      fileName: 'attachments/user-1/record-1/attachment-1.pdf',
      originalFileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      url: '/api/attachments/attachment-1/file',
      uploadedAt,
    });
    storageService.downloadObject.mockResolvedValue(Buffer.from('file-buffer'));

    const result = await service.getAttachmentFile('user-1', 'attachment-1');

    expect(storageService.downloadObject).toHaveBeenCalledWith(
      'attachments/user-1/record-1/attachment-1.pdf',
    );
    expect(result.fileBuffer).toEqual(Buffer.from('file-buffer'));
  });

  it('deletes the attachment record and stored object', async () => {
    prisma.attachment.findFirst = vi.fn().mockResolvedValue({
      id: 'attachment-1',
      maintenanceRecordId: 'record-1',
      kind: AttachmentKind.Document,
      fileName: 'attachments/user-1/record-1/attachment-1.pdf',
      originalFileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      url: '/api/attachments/attachment-1/file',
      uploadedAt,
    });
    prisma.attachment.delete = vi.fn().mockResolvedValue({ id: 'attachment-1' });

    const result = await service.deleteAttachment('user-1', 'attachment-1');

    expect(prisma.attachment.delete).toHaveBeenCalledWith({
      where: {
        id: 'attachment-1',
      },
    });
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'attachments/user-1/record-1/attachment-1.pdf',
    );
    expect(result).toEqual({
      id: 'attachment-1',
      deleted: true,
    });
  });
});
