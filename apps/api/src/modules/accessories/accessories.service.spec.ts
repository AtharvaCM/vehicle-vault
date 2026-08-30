import { AuditResourceType, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessoriesService } from './accessories.service';

type Mock = ReturnType<typeof vi.fn>;

const createdAt = new Date('2026-08-01T00:00:00.000Z');

const row = {
  id: 'accessory-1',
  vehicleId: 'vehicle-1',
  name: 'Dashcam',
  brand: '70mai',
  category: 'electronics',
  purchaseDate: new Date('2026-07-04T00:00:00.000Z'),
  cost: new Prisma.Decimal('7499.00'),
  currencyCode: 'INR',
  fittedDate: new Date('2026-07-06T00:00:00.000Z'),
  fittedOdometer: 5120,
  removedDate: null,
  removedOdometer: null,
  warrantyExpiresAt: new Date('2027-07-04T00:00:00.000Z'),
  notes: null,
  createdAt,
  updatedAt: createdAt,
};

function makePrismaMock() {
  return {
    accessory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // The interactive form of $transaction is what the audit-coverage proxy
    // instruments, so the mock has to run the callback rather than skip it.
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(makeTx())),
  };
}

let txAccessory: Record<string, Mock>;

function makeTx() {
  return { accessory: txAccessory };
}

describe('AccessoriesService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let vehiclesService: { ensureVehicleExists: Mock };
  let access: { assertEditor: Mock };
  let auditService: { track: Mock };
  let service: AccessoriesService;

  beforeEach(() => {
    txAccessory = {
      create: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
      delete: vi.fn().mockResolvedValue(row),
    };
    prisma = makePrismaMock();
    vehiclesService = { ensureVehicleExists: vi.fn().mockResolvedValue({ id: 'vehicle-1' }) };
    access = { assertEditor: vi.fn().mockResolvedValue(undefined) };
    auditService = { track: vi.fn().mockResolvedValue(undefined) };
    service = new AccessoriesService(
      prisma as never,
      vehiclesService as never,
      access as never,
      auditService as never,
    );
  });

  it('maps Decimal cost to a number and Dates to ISO strings', async () => {
    (prisma.accessory.findMany as Mock).mockResolvedValue([row]);

    const [accessory] = await service.listForVehicle('user-1', 'vehicle-1');

    expect(accessory).toMatchObject({
      id: 'accessory-1',
      cost: 7499,
      purchaseDate: '2026-07-04T00:00:00.000Z',
      fittedDate: '2026-07-06T00:00:00.000Z',
      removedDate: null,
      warrantyExpiresAt: '2027-07-04T00:00:00.000Z',
    });
    expect(typeof accessory!.cost).toBe('number');
  });

  it('writes an audit event inside the create transaction', async () => {
    // Not decoration: PrismaService instruments interactive transactions and
    // throws AuditCoverageError in dev and CI when a mutation has no audit row.
    await service.createForVehicle('user-1', 'vehicle-1', {
      name: 'Dashcam',
      purchaseDate: '2026-07-04T00:00:00.000Z',
      cost: 7499,
    });

    expect(access.assertEditor).toHaveBeenCalledWith('user-1', 'vehicle-1');
    expect(auditService.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'accessory.created',
        resourceType: AuditResourceType.accessory,
        resourceId: 'accessory-1',
      }),
    );
  });

  it('defaults the currency rather than writing an empty one', async () => {
    await service.createForVehicle('user-1', 'vehicle-1', {
      name: 'Floor mats',
      purchaseDate: '2026-07-04T00:00:00.000Z',
      cost: 1200,
    });

    expect(txAccessory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currencyCode: 'INR' }),
      }),
    );
  });

  it('rejects a payload that fails the shared schema with a 400, not a 500', async () => {
    // A raw ZodError would escape as an unhandled 500; the safeParse wrapper is
    // what keeps this a client error.
    await expect(
      service.createForVehicle('user-1', 'vehicle-1', {
        name: 'Roof rails',
        purchaseDate: '2026-07-04T00:00:00.000Z',
        cost: 3000,
        removedDate: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a removal dated before the fitment', async () => {
    await expect(
      service.createForVehicle('user-1', 'vehicle-1', {
        name: 'Roof rails',
        purchaseDate: '2026-07-04T00:00:00.000Z',
        cost: 3000,
        fittedDate: '2026-08-01T00:00:00.000Z',
        removedDate: '2026-07-10T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('clears a nullable column when the patch sends null, and leaves it alone when omitted', async () => {
    (prisma.accessory.findUnique as Mock).mockResolvedValue(row);

    await service.updateAccessory('user-1', 'accessory-1', { notes: null });

    const data = (txAccessory.update as Mock).mock.calls[0]![0].data;
    expect(data).toHaveProperty('notes', null);
    expect(data).not.toHaveProperty('brand');
  });

  it('gates item routes on the editor role resolved from the row', async () => {
    (prisma.accessory.findUnique as Mock).mockResolvedValue(row);

    await service.deleteAccessory('user-1', 'accessory-1');

    expect(access.assertEditor).toHaveBeenCalledWith('user-1', 'vehicle-1');
    expect(auditService.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'accessory.deleted' }),
    );
  });

  it('throws NotFound for an accessory that does not exist', async () => {
    (prisma.accessory.findUnique as Mock).mockResolvedValue(null);

    await expect(service.deleteAccessory('user-1', 'missing')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('excludes removed accessories from the warranty sweep', async () => {
    (prisma.accessory.findMany as Mock).mockResolvedValue([]);

    await service.findExpiringWarranties('user-1', 7);

    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          removedDate: null,
          vehicle: { members: { some: { userId: 'user-1' } } },
        }),
      }),
    );
  });
});
