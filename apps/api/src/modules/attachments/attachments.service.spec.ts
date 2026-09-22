import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AttachmentExtractionStatus,
  AttachmentKind,
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { heicConvertMock, randomUuidMock } = vi.hoisted(() => ({
  heicConvertMock: vi.fn(),
  randomUuidMock: vi.fn(),
}));

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');

  return {
    ...actual,
    randomUUID: randomUuidMock,
  };
});

vi.mock('heic-convert', () => ({
  default: heicConvertMock,
}));

import { AttachmentsService } from './attachments.service';

function createHeicBuffer() {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
  ]);
}

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
    maintenanceRecord: { findUnique: ReturnType<typeof vi.fn> };
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
    maintenanceRecord: {
      findUnique: vi.fn().mockResolvedValue({ vehicleId: 'vehicle-1' }),
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

  const auditService = {
    track: vi.fn().mockResolvedValue(undefined),
  };

  const extractionEnvelope = {
    provider: 'gemini' as const,
    extractedAt: '2026-03-20T00:00:00.000Z',
    confidence: 0.92,
    data: {
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
    },
  };

  const extractionService = {
    isAvailable: true,
    hasKind: vi.fn().mockReturnValue(true),
    extract: vi.fn().mockResolvedValue(extractionEnvelope),
  };

  let service: AttachmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(uploadedAt);
    randomUuidMock.mockReturnValue('attachment-1');
    heicConvertMock.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
    maintenanceService.getRecordById.mockResolvedValue({
      id: 'record-1',
    });
    prisma.maintenanceRecord.findUnique.mockResolvedValue({ vehicleId: 'vehicle-1' });
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
    extractionService.extract.mockResolvedValue(extractionEnvelope);
    extractionService.hasKind.mockReturnValue(true);
    extractionService.isAvailable = true;
    prisma.$transaction = vi.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(prisma);
      }
      return Promise.all(arg as Array<Promise<unknown> | unknown>);
    });
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
      extractionService as never,
      auditService as never,
      { getById: vi.fn(), listForUser: vi.fn() } as never,
      { assert: vi.fn(), assertEditor: vi.fn(), assertOwner: vi.fn(), resolve: vi.fn() } as never,
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

  it('converts HEIC uploads to JPEG before storing while preserving the original file name', async () => {
    const result = await service.uploadAttachments('user-1', 'record-1', [
      {
        originalname: 'service-photo.heic',
        mimetype: 'application/octet-stream',
        size: 1024,
        buffer: createHeicBuffer(),
      },
    ]);

    expect(heicConvertMock).toHaveBeenCalledWith({
      buffer: createHeicBuffer(),
      format: 'JPEG',
      quality: 0.9,
    });
    expect(storageService.uploadObject).toHaveBeenCalledWith(
      'attachments/user-1/record-1/attachment-1.jpg',
      Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
      'image/jpeg',
    );
    expect(result[0]).toMatchObject({
      kind: AttachmentKind.Image,
      fileName: 'attachments/user-1/record-1/attachment-1.jpg',
      originalFileName: 'service-photo.heic',
      mimeType: 'image/jpeg',
      size: 4,
    });
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
          vehicle: { members: { some: { userId: 'user-1' } } },
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

    expect(extractionService.extract).toHaveBeenCalledWith('maintenance_invoice', [
      {
        buffer: Buffer.from('%PDF-1.7'),
        mimeType: 'application/pdf',
        name: 'receipt.pdf',
      },
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        attachmentId: 'attachment-1',
        status: AttachmentExtractionStatus.Completed,
        invoiceNumber: 'INV-1',
        totalCost: 2499,
      }),
    );
  });

  it('extracts multiple attachments as one merged maintenance document', async () => {
    prisma.attachment.findMany = vi.fn().mockResolvedValue([
      {
        id: 'attachment-1',
        maintenanceRecordId: 'record-1',
        kind: AttachmentKind.Image,
        fileName: 'attachments/user-1/record-1/page-1.jpg',
        originalFileName: 'page-1.heic',
        mimeType: 'image/jpeg',
        size: 1024,
        url: '/api/attachments/attachment-1/file',
        uploadedAt,
        extraction: null,
      },
      {
        id: 'attachment-2',
        maintenanceRecordId: 'record-1',
        kind: AttachmentKind.Image,
        fileName: 'attachments/user-1/record-1/page-2.jpg',
        originalFileName: 'page-2.heic',
        mimeType: 'image/jpeg',
        size: 1024,
        url: '/api/attachments/attachment-2/file',
        uploadedAt,
        extraction: null,
      },
    ]);
    storageService.downloadObject
      .mockResolvedValueOnce(Buffer.from([0xff, 0xd8, 0xff, 0x01]))
      .mockResolvedValueOnce(Buffer.from([0xff, 0xd8, 0xff, 0x02]));

    const result = await service.extractAttachments('user-1', 'record-1', [
      'attachment-1',
      'attachment-2',
    ]);

    expect(maintenanceService.getRecordById).toHaveBeenCalledWith('user-1', 'record-1');
    expect(extractionService.extract).toHaveBeenCalledWith('maintenance_invoice', [
      {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x01]),
        mimeType: 'image/jpeg',
        name: 'page-1.heic',
      },
      {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x02]),
        mimeType: 'image/jpeg',
        name: 'page-2.heic',
      },
    ]);
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

  it('will not apply an extraction over a confirmed record, which it would turn back into a draft', async () => {
    prisma.attachment.findFirst = vi.fn().mockResolvedValue({
      id: 'attachment-1',
      maintenanceRecordId: 'record-1',
      kind: AttachmentKind.Image,
      fileName: 'attachments/user-1/record-1/attachment-1.jpg',
      originalFileName: 'job-card.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      url: '/api/attachments/attachment-1/file',
      uploadedAt,
      extraction: {
        id: 'extraction-1',
        attachmentId: 'attachment-1',
        status: AttachmentExtractionStatus.Completed,
        provider: 'gemini',
        confidence: null,
        vendorName: null,
        workshopName: 'Torque Garage',
        invoiceNumber: null,
        documentDate: null,
        serviceDate: new Date('2026-03-20T00:00:00.000Z'),
        odometer: 12500,
        totalCost: 2499,
        currencyCode: 'INR',
        notes: null,
        lineItems: null,
        failureReason: null,
        extractedAt: uploadedAt,
        createdAt: uploadedAt,
        updatedAt: uploadedAt,
      },
    });
    maintenanceService.getRecordById.mockResolvedValue({
      id: 'record-1',
      status: MaintenanceRecordStatus.Confirmed,
    });

    await expect(service.applyExtraction('user-1', 'attachment-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(maintenanceService.updateRecord).not.toHaveBeenCalled();
  });

  describe('files on insurance policies and warranties', () => {
    const access = {
      assert: vi.fn(),
      assertEditor: vi.fn(),
      assertOwner: vi.fn(),
      resolve: vi.fn(),
    };
    const documents = {
      insurancePolicy: { findUnique: vi.fn() },
      warranty: { findUnique: vi.fn() },
      complianceDocument: { findFirst: vi.fn(), findUnique: vi.fn() },
    };
    const policyFile = {
      originalname: 'policy.pdf',
      mimetype: 'application/pdf',
      size: 2048,
      buffer: Buffer.from('%PDF-1.7 policy'),
    };
    let documentService: AttachmentsService;

    beforeEach(() => {
      access.assert.mockResolvedValue('editor');
      access.assertEditor.mockResolvedValue('editor');
      // The policy is on someone else's vehicle, shared with this user as an editor.
      documents.insurancePolicy.findUnique.mockResolvedValue({
        vehicleId: 'vehicle-1',
        vehicle: { userId: 'owner-1' },
      });
      documents.warranty.findUnique.mockResolvedValue({
        vehicleId: 'vehicle-1',
        vehicle: { userId: 'owner-1' },
      });
      documents.complianceDocument.findFirst.mockResolvedValue({
        vehicleId: 'vehicle-1',
        vehicle: { userId: 'owner-1' },
      });
      documentService = new AttachmentsService(
        { ...prisma, ...documents } as never,
        maintenanceService as never,
        storageService as never,
        extractionService as never,
        auditService as never,
        { getById: vi.fn(), listForUser: vi.fn() } as never,
        access as never,
      );
    });

    it("lists a policy's files for any member of its vehicle", async () => {
      prisma.attachment.findMany.mockResolvedValue([]);

      await documentService.listByDocument('user-1', 'insurance', 'pol-1');

      expect(access.assert).toHaveBeenCalledWith('user-1', 'vehicle-1');
      expect(prisma.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { insurancePolicyId: 'pol-1' } }),
      );
    });

    it("stores an upload against the policy, audited in the vehicle owner's trail", async () => {
      const result = await documentService.uploadDocumentAttachments(
        'user-1',
        'insurance',
        'pol-1',
        [policyFile],
      );

      expect(access.assertEditor).toHaveBeenCalledWith('user-1', 'vehicle-1');
      expect(storageService.uploadObject).toHaveBeenCalledWith(
        'attachments/user-1/pol-1/attachment-1.pdf',
        expect.any(Buffer),
        'application/pdf',
      );
      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ insurancePolicyId: 'pol-1' }),
        }),
      );
      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ actorUserId: 'user-1', ownerUserId: 'owner-1' }),
      );
      expect(result[0]).toMatchObject({
        insurancePolicyId: 'pol-1',
        originalFileName: 'policy.pdf',
      });
    });

    it("files a warranty's upload under the warranty", async () => {
      await documentService.uploadDocumentAttachments('user-1', 'warranty', 'wty-1', [policyFile]);

      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ warrantyId: 'wty-1' }) }),
      );
    });

    it('files a PUC certificate under its compliance record, checked against its kind', async () => {
      await documentService.uploadDocumentAttachments('user-1', 'puc', 'puc-1', [policyFile]);

      expect(documents.complianceDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'puc-1', kind: 'puc' } }),
      );
      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ complianceDocumentId: 'puc-1' }),
        }),
      );
    });

    it('does not reach a compliance record through another kind', async () => {
      // A PUC certificate asked for as a registration certificate.
      documents.complianceDocument.findFirst.mockResolvedValue(null);

      await expect(
        documentService.listByDocument('user-1', 'registration', 'puc-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses a viewer's upload before anything is stored", async () => {
      access.assertEditor.mockRejectedValue(new ForbiddenException());

      await expect(
        documentService.uploadDocumentAttachments('viewer-1', 'insurance', 'pol-1', [policyFile]),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storageService.uploadObject).not.toHaveBeenCalled();
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('answers 404 for a document that does not exist', async () => {
      documents.insurancePolicy.findUnique.mockResolvedValue(null);

      await expect(
        documentService.listByDocument('user-1', 'insurance', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets any member of the vehicle open a document's file", async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'attachment-1',
        insurancePolicyId: 'pol-1',
        maintenanceRecordId: null,
        vehicleLoanId: null,
        warrantyId: null,
        claimId: null,
        kind: AttachmentKind.Document,
        fileName: 'attachments/owner-1/pol-1/a.pdf',
        originalFileName: 'policy.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        url: '/api/attachments/attachment-1/file',
        uploadedAt,
        extraction: null,
      });

      await documentService.getAttachmentById('viewer-1', 'attachment-1');

      const where = prisma.attachment.findFirst.mock.calls.at(-1)?.[0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { insurancePolicy: { vehicle: { members: { some: { userId: 'viewer-1' } } } } },
          { warranty: { vehicle: { members: { some: { userId: 'viewer-1' } } } } },
        ]),
      );
    });

    it("removes a policy's file only for an editor", async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'attachment-1',
        insurancePolicyId: 'pol-1',
        maintenanceRecordId: null,
        vehicleLoanId: null,
        warrantyId: null,
        fileName: 'attachments/owner-1/pol-1/a.pdf',
        extraction: null,
      });
      access.assertEditor.mockRejectedValueOnce(new ForbiddenException());

      await expect(
        documentService.deleteAttachment('viewer-1', 'attachment-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storageService.deleteObject).not.toHaveBeenCalled();

      await documentService.deleteAttachment('user-1', 'attachment-1');
      expect(storageService.deleteObject).toHaveBeenCalledWith('attachments/owner-1/pol-1/a.pdf');
      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'attachment.deleted', ownerUserId: 'owner-1' }),
      );
    });
  });
});
