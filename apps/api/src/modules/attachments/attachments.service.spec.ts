import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentKind } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildStoredFileNameMock,
  deleteStoredAttachmentFileMock,
  ensureUploadsDirectoryMock,
  getAttachmentAbsolutePathMock,
  randomUuidMock,
  accessMock,
  mkdirMock,
  unlinkMock,
  writeFileMock,
} = vi.hoisted(() => ({
  buildStoredFileNameMock: vi.fn(),
  deleteStoredAttachmentFileMock: vi.fn(),
  ensureUploadsDirectoryMock: vi.fn(),
  getAttachmentAbsolutePathMock: vi.fn(),
  randomUuidMock: vi.fn(),
  accessMock: vi.fn(),
  mkdirMock: vi.fn(),
  unlinkMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: randomUuidMock,
}));

vi.mock('node:fs/promises', () => ({
  access: accessMock,
  mkdir: mkdirMock,
  unlink: unlinkMock,
  writeFile: writeFileMock,
}));

vi.mock('./utils/attachment-upload.util', async () => {
  const actual = await vi.importActual<typeof import('./utils/attachment-upload.util')>(
    './utils/attachment-upload.util',
  );

  return {
    ...actual,
    buildStoredFileName: buildStoredFileNameMock,
    deleteStoredAttachmentFile: deleteStoredAttachmentFileMock,
    ensureUploadsDirectory: ensureUploadsDirectoryMock,
    getAttachmentAbsolutePath: getAttachmentAbsolutePathMock,
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

  let service: AttachmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    buildStoredFileNameMock.mockReturnValue('stored-receipt.pdf');
    getAttachmentAbsolutePathMock.mockImplementation((fileName: string) => `/tmp/${fileName}`);
    randomUuidMock.mockReturnValue('attachment-1');
    prisma.$transaction = vi.fn(async (operations: Array<Promise<unknown> | unknown>) =>
      Promise.all(operations),
    );
    prisma.attachment.create = vi.fn().mockResolvedValue({
      id: 'attachment-1',
      maintenanceRecordId: 'record-1',
      kind: AttachmentKind.Document,
      fileName: 'stored-receipt.pdf',
      originalFileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      url: '/api/attachments/attachment-1/file',
      uploadedAt,
    });

    service = new AttachmentsService(prisma, maintenanceService as never);
  });

  it('uploads attachment metadata for a maintenance record and stores the file on disk', async () => {
    const result = await service.uploadAttachments('user-1', 'record-1', [
      {
        originalname: 'receipt.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.7 test payload'),
      },
    ]);

    expect(maintenanceService.getRecordById).toHaveBeenCalledWith('user-1', 'record-1');
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/stored-receipt.pdf', expect.any(Buffer));
    expect(result).toEqual([
      {
        id: 'attachment-1',
        maintenanceRecordId: 'record-1',
        kind: AttachmentKind.Document,
        fileName: 'stored-receipt.pdf',
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

  it('rejects unsupported file types', async () => {
    await expect(
      service.uploadAttachments('user-1', 'record-1', [
        {
          originalname: 'script.sh',
          mimetype: 'text/plain',
          size: 100,
          buffer: Buffer.from('echo nope'),
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('rejects files whose extension does not match the declared type', async () => {
    await expect(
      service.uploadAttachments('user-1', 'record-1', [
        {
          originalname: 'receipt.png',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('%PDF-1.7 test payload'),
        },
      ]),
    ).rejects.toMatchObject({
      message: 'The file extension does not match the uploaded file type.',
    });
  });

  it('rejects files whose binary signature does not match the declared type', async () => {
    await expect(
      service.uploadAttachments('user-1', 'record-1', [
        {
          originalname: 'receipt.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('not a pdf'),
        },
      ]),
    ).rejects.toMatchObject({
      message: 'Uploaded file content does not match the declared file type.',
    });
  });

  it('sanitizes original file names before storing metadata', async () => {
    prisma.attachment.create = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        ...data,
        uploadedAt,
      }),
    );

    const result = await service.uploadAttachments('user-1', 'record-1', [
      {
        originalname: '../../receipt.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.7 test payload'),
      },
    ]);

    expect(buildStoredFileNameMock).toHaveBeenCalledWith('receipt.pdf');
    expect(result[0]?.originalFileName).toBe('receipt.pdf');
  });

  it('returns not found when the stored attachment file is missing', async () => {
    prisma.attachment.findFirst = vi.fn().mockResolvedValue({
      id: 'attachment-1',
      maintenanceRecordId: 'record-1',
      kind: AttachmentKind.Document,
      fileName: 'stored-receipt.pdf',
      originalFileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      url: '/api/attachments/attachment-1/file',
      uploadedAt,
    });
    accessMock.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    await expect(service.getAttachmentFile('user-1', 'attachment-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes the attachment record and stored file', async () => {
    prisma.attachment.findFirst = vi.fn().mockResolvedValue({
      id: 'attachment-1',
      maintenanceRecordId: 'record-1',
      kind: AttachmentKind.Document,
      fileName: 'stored-receipt.pdf',
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
    expect(deleteStoredAttachmentFileMock).toHaveBeenCalledWith('stored-receipt.pdf');
    expect(result).toEqual({
      id: 'attachment-1',
      deleted: true,
    });
  });
});
