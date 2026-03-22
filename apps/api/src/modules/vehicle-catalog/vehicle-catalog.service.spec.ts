import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FuelType, VehicleCatalogMarket, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { upsertCatalogDataset } from '../../../prisma/catalog-import/upsert-catalog-dataset';
import { VehicleCatalogService } from './vehicle-catalog.service';

vi.mock('../../../prisma/catalog-import/upsert-catalog-dataset', () => ({
  upsertCatalogDataset: vi.fn(),
}));

const snapshotPayload = {
  dataset: [
    {
      marketCode: 'IN',
      vehicleType: 'suv',
      name: 'Hyundai',
      sourceUrl: 'https://www.hyundai.com/in/en/find-a-car',
      models: [
        {
          name: 'Creta',
          generations: [
            {
              name: 'Creta (2024 facelift)',
              yearStart: 2024,
              isCurrent: true,
              variants: [
                {
                  name: 'SX (O)',
                  offerings: [
                    {
                      fuelTypes: ['petrol', 'diesel'],
                      yearStart: 2024,
                      isCurrent: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('VehicleCatalogService', () => {
  const prisma = {
    vehicleCatalogMake: {
      findMany: vi.fn(),
    },
    vehicleCatalogModel: {
      findMany: vi.fn(),
    },
    vehicleCatalogVariant: {
      findMany: vi.fn(),
    },
    vehicleCatalogVariantOffering: {
      findMany: vi.fn(),
    },
    vehicleCatalogImportRun: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  let service: VehicleCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => unknown) =>
      callback(prisma),
    );
    service = new VehicleCatalogService(prisma as never);
  });

  it('lists market-scoped makes for a vehicle type', async () => {
    prisma.vehicleCatalogMake.findMany.mockResolvedValue([
      {
        id: 'make-1',
        marketCode: 'IN',
        vehicleType: VehicleType.Car,
        name: 'Hyundai',
      },
    ]);

    await expect(
      service.listMakes({
        marketCode: VehicleCatalogMarket.India,
        vehicleType: VehicleType.Car,
      }),
    ).resolves.toEqual([
      {
        id: 'make-1',
        marketCode: VehicleCatalogMarket.India,
        vehicleType: VehicleType.Car,
        name: 'Hyundai',
      },
    ]);
  });

  it('lists models scoped by make and year', async () => {
    prisma.vehicleCatalogModel.findMany.mockResolvedValue([
      {
        id: 'model-1',
        makeId: 'make-1',
        name: 'Creta',
      },
    ]);

    await expect(
      service.listModels({
        make: 'Hyundai',
        marketCode: VehicleCatalogMarket.India,
        vehicleType: VehicleType.SUV,
        year: 2024,
      }),
    ).resolves.toEqual([
      {
        id: 'model-1',
        makeId: 'make-1',
        name: 'Creta',
      },
    ]);
  });

  it('lists variants with year and fuel type metadata', async () => {
    prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
      {
        id: 'variant-1',
        name: 'SX (O)',
        generation: {
          modelId: 'model-1',
        },
        offerings: [
          {
            fuelTypes: [FuelType.Petrol, FuelType.Diesel],
            yearStart: 2024,
            yearEnd: null,
            isCurrent: true,
          },
        ],
      },
    ]);

    await expect(
      service.listVariants({
        make: 'Hyundai',
        marketCode: VehicleCatalogMarket.India,
        model: 'Creta',
        vehicleType: VehicleType.SUV,
        year: 2025,
      }),
    ).resolves.toEqual([
      {
        id: 'variant-1',
        modelId: 'model-1',
        name: 'SX (O)',
        fuelTypes: [FuelType.Petrol, FuelType.Diesel],
        yearStart: 2024,
        yearEnd: undefined,
        isCurrent: true,
      },
    ]);
  });

  it('lists staged import runs with diff summaries', async () => {
    prisma.vehicleCatalogImportRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        sourceKey: 'hyundai-india',
        marketCode: 'IN',
        status: 'succeeded',
        startedAt: new Date('2026-03-22T10:00:00.000Z'),
        completedAt: new Date('2026-03-22T10:01:00.000Z'),
        snapshotCount: 1,
        recordsUpserted: 0,
        notes: null,
        publishedAt: null,
        publishedByUserId: null,
        snapshots: [
          {
            capturedAt: new Date('2026-03-22T10:00:30.000Z'),
            payload: snapshotPayload,
          },
        ],
      },
    ]);
    prisma.vehicleCatalogVariantOffering.findMany.mockResolvedValue([]);

    await expect(service.listImportRuns()).resolves.toEqual([
      expect.objectContaining({
        id: 'run-1',
        sourceKey: 'hyundai-india',
        publishedAt: undefined,
        diff: expect.objectContaining({
          incomingCounts: expect.objectContaining({
            makes: 1,
            models: 1,
            generations: 1,
            variants: 1,
            offerings: 1,
          }),
          newModels: ['Hyundai / Creta'],
          newVariants: ['Hyundai / Creta / Creta (2024 facelift) / SX (O)'],
        }),
      }),
    ]);
  });

  it('returns detailed review data for a staged import run', async () => {
    prisma.vehicleCatalogImportRun.findUnique.mockResolvedValue({
      id: 'run-1',
      sourceKey: 'hyundai-india',
      marketCode: 'IN',
      status: 'succeeded',
      startedAt: new Date('2026-03-22T10:00:00.000Z'),
      completedAt: new Date('2026-03-22T10:01:00.000Z'),
      snapshotCount: 1,
      recordsUpserted: 0,
      notes: null,
      publishedAt: null,
      publishedByUserId: null,
      snapshots: [
        {
          capturedAt: new Date('2026-03-22T10:00:30.000Z'),
          payload: snapshotPayload,
        },
      ],
    });
    prisma.vehicleCatalogVariantOffering.findMany.mockResolvedValue([]);

    await expect(service.getImportRunDetail('run-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'run-1',
        dataset: snapshotPayload.dataset,
      }),
    );
  });

  it('publishes a staged import run into the trusted catalog', async () => {
    prisma.vehicleCatalogImportRun.findUnique.mockResolvedValue({
      id: 'run-1',
      sourceKey: 'hyundai-india',
      marketCode: 'IN',
      status: 'succeeded',
      startedAt: new Date('2026-03-22T10:00:00.000Z'),
      completedAt: new Date('2026-03-22T10:01:00.000Z'),
      snapshotCount: 1,
      recordsUpserted: 0,
      notes: null,
      publishedAt: null,
      publishedByUserId: null,
      snapshots: [
        {
          capturedAt: new Date('2026-03-22T10:00:30.000Z'),
          payload: snapshotPayload,
        },
      ],
    });
    prisma.vehicleCatalogImportRun.findFirst.mockResolvedValue(null);
    prisma.vehicleCatalogImportRun.update.mockResolvedValue({
      id: 'run-1',
      sourceKey: 'hyundai-india',
      marketCode: 'IN',
      status: 'succeeded',
      startedAt: new Date('2026-03-22T10:00:00.000Z'),
      completedAt: new Date('2026-03-22T10:01:00.000Z'),
      snapshotCount: 1,
      recordsUpserted: 14,
      notes: null,
      publishedAt: new Date('2026-03-22T11:00:00.000Z'),
      publishedByUserId: 'user-1',
      snapshots: [
        {
          capturedAt: new Date('2026-03-22T10:00:30.000Z'),
          payload: snapshotPayload,
        },
      ],
    });
    prisma.vehicleCatalogVariantOffering.findMany.mockResolvedValue([]);
    vi.mocked(upsertCatalogDataset).mockResolvedValue(14);

    await expect(service.publishImportRun('user-1', 'run-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'run-1',
        publishedByUserId: 'user-1',
        recordsUpserted: 14,
      }),
    );
    expect(upsertCatalogDataset).toHaveBeenCalled();
  });

  it('archives missing published variants as historical before publish', async () => {
    prisma.vehicleCatalogImportRun.findUnique
      .mockResolvedValueOnce({
        id: 'run-1',
        sourceKey: 'hyundai-india',
        marketCode: 'IN',
        status: 'succeeded',
        startedAt: new Date('2026-03-22T10:00:00.000Z'),
        completedAt: new Date('2026-03-22T10:01:00.000Z'),
        snapshotCount: 1,
        recordsUpserted: 0,
        notes: null,
        publishedAt: null,
        publishedByUserId: null,
        snapshots: [
          {
            capturedAt: new Date('2026-03-22T10:00:30.000Z'),
            payload: snapshotPayload,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        sourceKey: 'hyundai-india',
        marketCode: 'IN',
        status: 'succeeded',
        startedAt: new Date('2026-03-22T10:00:00.000Z'),
        completedAt: new Date('2026-03-22T10:01:00.000Z'),
        snapshotCount: 1,
        recordsUpserted: 0,
        notes: null,
        publishedAt: null,
        publishedByUserId: null,
        snapshots: [
          {
            capturedAt: new Date('2026-03-22T10:00:30.000Z'),
            payload: snapshotPayload,
          },
        ],
      });
    prisma.vehicleCatalogVariantOffering.findMany
      .mockResolvedValueOnce([
        {
          id: 'offering-1',
          fuelTypes: [FuelType.Petrol, FuelType.Diesel],
          yearStart: 2024,
          yearEnd: null,
          isCurrent: true,
          sourceUrl: 'https://example.com',
          variant: {
            name: 'Legacy Trim',
            sourceUrl: 'https://example.com',
            generation: {
              name: 'Creta (2024 facelift)',
              yearStart: 2024,
              yearEnd: null,
              isCurrent: true,
              sourceUrl: 'https://example.com',
              model: {
                name: 'Creta',
                sourceUrl: 'https://example.com',
                make: {
                  name: 'Hyundai',
                  marketCode: 'IN',
                  vehicleType: VehicleType.SUV,
                  sourceUrl: 'https://example.com',
                },
              },
            },
          },
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.vehicleCatalogVariantOffering.updateMany = vi.fn().mockResolvedValue({ count: 1 });

    await expect(service.archiveMissingVariants('run-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'run-1',
        diff: expect.objectContaining({
          missingVariants: [],
        }),
      }),
    );
    expect(prisma.vehicleCatalogVariantOffering.updateMany).toHaveBeenCalledTimes(2);
  });

  it('rejects publishing a run when a newer successful import exists', async () => {
    prisma.vehicleCatalogImportRun.findUnique.mockResolvedValue({
      id: 'run-1',
      sourceKey: 'hyundai-india',
      marketCode: 'IN',
      status: 'succeeded',
      startedAt: new Date('2026-03-22T10:00:00.000Z'),
      completedAt: new Date('2026-03-22T10:01:00.000Z'),
      snapshotCount: 1,
      recordsUpserted: 0,
      notes: null,
      publishedAt: null,
      publishedByUserId: null,
      snapshots: [
        {
          capturedAt: new Date('2026-03-22T10:00:30.000Z'),
          payload: snapshotPayload,
        },
      ],
    });
    prisma.vehicleCatalogImportRun.findFirst.mockResolvedValue({
      id: 'run-2',
    });

    await expect(service.publishImportRun('user-1', 'run-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when an import run is missing', async () => {
    prisma.vehicleCatalogImportRun.findUnique.mockResolvedValue(null);

    await expect(service.getImportRunDetail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects archiving missing variants after a run has been published', async () => {
    prisma.vehicleCatalogImportRun.findUnique.mockResolvedValue({
      id: 'run-1',
      sourceKey: 'hyundai-india',
      marketCode: 'IN',
      status: 'succeeded',
      startedAt: new Date('2026-03-22T10:00:00.000Z'),
      completedAt: new Date('2026-03-22T10:01:00.000Z'),
      snapshotCount: 1,
      recordsUpserted: 10,
      notes: null,
      publishedAt: new Date('2026-03-22T11:00:00.000Z'),
      publishedByUserId: 'user-1',
      snapshots: [
        {
          capturedAt: new Date('2026-03-22T10:00:30.000Z'),
          payload: snapshotPayload,
        },
      ],
    });

    await expect(service.archiveMissingVariants('run-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
