import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AttachmentExtractionStatus,
  AttachmentKind,
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
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
    deleteMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };

  type AttachmentExtractionDelegateMock = {
    upsert: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    $transaction: ReturnType<typeof vi.fn>;
    attachment: AttachmentDelegateMock;
    attachmentExtraction: AttachmentExtractionDelegateMock;
  };

  const uploadedAt = new Date('2026-03-20T00:00:00.000Z');

  const prisma: PrismaMock = {
    $transaction: vi.fn(),
    attachment: {
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    attachmentExtraction: {
      upsert: vi.fn(),
    },
  };

  const maintenanceService = {
    getRecordById: vi.fn().mockResolvedValue({
      id: 'record-1',
    }),
    updateRecord: vi.fn().mockResolvedValue({
      id: 'record-1',
      vehicleId: 'vehicle-1',
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-20T00:00:00.000Z',
      odometer: 12500,
      workshopName: 'Torque Garage',
      invoiceNumber: 'INV-1',
      currencyCode: 'INR',
      source: MaintenanceSource.Ocr,
      status: MaintenanceRecordStatus.Draft,
      totalCost: 2499,
      notes: 'OCR notes',
      lineItems: [],
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z',
    }),
  };

  const storageService = {
    deleteObject: vi.fn(),
    downloadObject: vi.fn(),
    objectExists: vi.fn(),
    uploadObject: vi.fn(),
  };

  const attachmentExtractionService = {
    isAvailable: true,
    extractDocument: vi.fn().mockResolvedValue({
      provider: 'gemini',
      confidence: 0.92,
      vendorName: 'Torque Garage',
      workshopName: 'Torque Garage',
      invoiceNumber: 'INV-1',
      documentDate: '2026-03-19T00:00:00.000Z',
      serviceDate: '2026-03-20T00:00:00.000Z',
      odometer: 12500,
      totalCost: 2499,
      currencyCode: 'INR',
      notes: 'OCR notes',
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Part,
          name: 'Oil filter',
          normalizedCategory: MaintenanceCategory.OilFilter,
          quantity: 1,
          unit: 'pcs',
          unitPrice: 450,
          lineTotal: 450,
        },
      ],
      extractedAt: '2026-03-20T00:00:00.000Z',
      failureReason: undefined,
    }),
  };

  let service: AttachmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(uploadedAt);
    randomUuidMock.mockReturnValue('attachment-1');
    maintenanceService.getRecordById.mockResolvedValue({
      id: 'record-1',
    });
    maintenanceService.updateRecord.mockResolvedValue({
      id: 'record-1',
      vehicleId: 'vehicle-1',
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-20T00:00:00.000Z',
      odometer: 12500,
      workshopName: 'Torque Garage',
      invoiceNumber: 'INV-1',
      currencyCode: 'INR',
      source: MaintenanceSource.Ocr,
      status: MaintenanceRecordStatus.Draft,
      totalCost: 2499,
      notes: 'OCR notes',
      lineItems: [],
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z',
    });
    attachmentExtractionService.extractDocument.mockResolvedValue({
      provider: 'gemini',
      confidence: 0.92,
      vendorName: 'Torque Garage',
      workshopName: 'Torque Garage',
      invoiceNumber: 'INV-1',
      documentDate: '2026-03-19T00:00:00.000Z',
      serviceDate: '2026-03-20T00:00:00.000Z',
      odometer: 12500,
      totalCost: 2499,
      currencyCode: 'INR',
      notes: 'OCR notes',
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Part,
          name: 'Oil filter',
          normalizedCategory: MaintenanceCategory.OilFilter,
          quantity: 1,
          unit: 'pcs',
          unitPrice: 450,
          lineTotal: 450,
        },
      ],
      extractedAt: '2026-03-20T00:00:00.000Z',
      failureReason: undefined,
    });
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
    storageService.objectExists.mockResolvedValue(true);
    storageService.uploadObject.mockResolvedValue(undefined);
    prisma.attachmentExtraction.upsert = vi.fn().mockImplementation(({ create, update }) =>
      Promise.resolve({
        id: 'extraction-1',
        attachmentId: 'attachment-1',
        status: (update?.status ?? create.status) || AttachmentExtractionStatus.Completed,
        provider: update?.provider ?? create.provider ?? 'gemini',
        confidence: 0.92,
        vendorName: 'Torque Garage',
        workshopName: 'Torque Garage',
        invoiceNumber: 'INV-1',
        documentDate: new Date('2026-03-19T00:00:00.000Z'),
        serviceDate: new Date('2026-03-20T00:00:00.000Z'),
        odometer: 12500,
        totalCost: 2499,
        currencyCode: 'INR',
        notes: 'OCR notes',
        lineItems: [
          {
            kind: MaintenanceLineItemKind.Part,
            name: 'Oil filter',
            normalizedCategory: MaintenanceCategory.OilFilter,
            quantity: 1,
            unit: 'pcs',
            unitPrice: 450,
            lineTotal: 450,
          },
        ],
        failureReason: update?.failureReason ?? null,
        extractedAt: new Date('2026-03-20T00:00:00.000Z'),
        createdAt: uploadedAt,
        updatedAt: uploadedAt,
      }),
    );

    service = new AttachmentsService(
      prisma as never,
      maintenanceService as never,
      storageService as never,
      attachmentExtractionService as never,
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
    storageService.deleteObject.mockResolvedValue('deleted');
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

  it('does not delete metadata when cloud deletion fails', async () => {
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
    storageService.deleteObject.mockRejectedValue(new Error('storage failed'));

    await expect(service.deleteAttachment('user-1', 'attachment-1')).rejects.toThrow(
      'storage failed',
    );
    expect(prisma.attachment.delete).not.toHaveBeenCalled();
  });

  it('reconciles missing attachment metadata for the current user', async () => {
    prisma.attachment.findMany = vi.fn().mockResolvedValue([
      { id: 'attachment-1', fileName: 'attachments/user-1/record-1/attachment-1.pdf' },
      { id: 'attachment-2', fileName: 'attachments/user-1/record-1/attachment-2.pdf' },
    ]);
    prisma.attachment.deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    storageService.objectExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await service.reconcileAttachments('user-1');

    expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['attachment-1'],
        },
        maintenanceRecord: {
          vehicle: {
            userId: 'user-1',
          },
        },
      },
    });
    expect(result).toEqual({
      checkedCount: 2,
      healthyCount: 1,
      removedMissingMetadataCount: 1,
      removedAttachmentIds: ['attachment-1'],
    });
  });

  it('reports whether OCR extraction is available', () => {
    expect(service.getExtractionStatus()).toEqual({
      available: true,
    });
  });

  it('extracts structured data for an uploaded attachment', async () => {
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
      extraction: null,
    });
    storageService.downloadObject.mockResolvedValue(Buffer.from('%PDF-1.7'));

    const result = await service.extractAttachment('user-1', 'attachment-1');

    expect(attachmentExtractionService.extractDocument).toHaveBeenCalledWith(
      Buffer.from('%PDF-1.7'),
      'application/pdf',
    );
    expect(result).toEqual(
      expect.objectContaining({
        attachmentId: 'attachment-1',
        status: AttachmentExtractionStatus.Completed,
        invoiceNumber: 'INV-1',
        totalCost: 2499,
      }),
    );
  });

  it('applies a completed extraction back into the maintenance draft', async () => {
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
      extraction: {
        id: 'extraction-1',
        attachmentId: 'attachment-1',
        status: AttachmentExtractionStatus.Completed,
        provider: 'gemini',
        confidence: 0.92,
        vendorName: 'Torque Garage',
        workshopName: 'Torque Garage',
        invoiceNumber: 'INV-1',
        documentDate: new Date('2026-03-19T00:00:00.000Z'),
        serviceDate: new Date('2026-03-20T00:00:00.000Z'),
        odometer: 12500,
        totalCost: 2499,
        currencyCode: 'INR',
        notes: 'OCR notes',
        lineItems: [
          {
            kind: MaintenanceLineItemKind.Part,
            name: 'Oil filter',
            normalizedCategory: MaintenanceCategory.OilFilter,
            quantity: 1,
            unit: 'pcs',
            unitPrice: 450,
            lineTotal: 450,
          },
        ],
        failureReason: null,
        extractedAt: new Date('2026-03-20T00:00:00.000Z'),
        createdAt: uploadedAt,
        updatedAt: uploadedAt,
      },
    });

    await service.applyExtraction('user-1', 'attachment-1');

    expect(maintenanceService.updateRecord).toHaveBeenCalledWith(
      'user-1',
      'record-1',
      expect.objectContaining({
        category: MaintenanceCategory.OilFilter,
        source: MaintenanceSource.Ocr,
        status: MaintenanceRecordStatus.Draft,
        invoiceNumber: 'INV-1',
        odometer: 12500,
        totalCost: 2499,
      }),
    );
  });
});
