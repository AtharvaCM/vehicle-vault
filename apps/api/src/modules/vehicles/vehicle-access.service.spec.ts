import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VehicleRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleAccessService } from './vehicle-access.service';

describe('VehicleAccessService', () => {
  const prisma = {
    vehicleMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };

  let access: VehicleAccessService;

  beforeEach(() => {
    vi.clearAllMocks();
    access = new VehicleAccessService(prisma as never);
  });

  it('resolve returns the role when a membership row exists', async () => {
    prisma.vehicleMember.findUnique.mockResolvedValueOnce({ role: VehicleRole.editor });
    await expect(access.resolve('u', 'v')).resolves.toBe(VehicleRole.editor);
    expect(prisma.vehicleMember.findUnique).toHaveBeenCalledWith({
      where: { vehicleId_userId: { vehicleId: 'v', userId: 'u' } },
      select: { role: true },
    });
  });

  it('resolve returns null when no membership exists', async () => {
    prisma.vehicleMember.findUnique.mockResolvedValueOnce(null);
    await expect(access.resolve('u', 'v')).resolves.toBeNull();
  });

  it('assert throws NotFound for non-members regardless of requested role', async () => {
    prisma.vehicleMember.findUnique.mockResolvedValue(null);
    await expect(access.assert('u', 'v')).rejects.toBeInstanceOf(NotFoundException);
    await expect(access.assert('u', 'v', VehicleRole.owner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('assert returns the role when at or above the minimum', async () => {
    prisma.vehicleMember.findUnique.mockResolvedValueOnce({ role: VehicleRole.owner });
    await expect(access.assert('u', 'v', VehicleRole.editor)).resolves.toBe(VehicleRole.owner);
  });

  it('assert throws Forbidden when role is below the minimum', async () => {
    prisma.vehicleMember.findUnique.mockResolvedValueOnce({ role: VehicleRole.viewer });
    await expect(access.assert('u', 'v', VehicleRole.editor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('assertOwner only accepts owner role', async () => {
    prisma.vehicleMember.findUnique.mockResolvedValueOnce({ role: VehicleRole.editor });
    await expect(access.assertOwner('u', 'v')).rejects.toBeInstanceOf(ForbiddenException);
    prisma.vehicleMember.findUnique.mockResolvedValueOnce({ role: VehicleRole.owner });
    await expect(access.assertOwner('u', 'v')).resolves.toBe(VehicleRole.owner);
  });

  it('listAccessibleVehicleIds filters by minimum role', async () => {
    prisma.vehicleMember.findMany.mockResolvedValueOnce([
      { vehicleId: 'v1' },
      { vehicleId: 'v2' },
    ]);
    const ids = await access.listAccessibleVehicleIds('u', VehicleRole.editor);
    expect(ids).toEqual(['v1', 'v2']);
    expect(prisma.vehicleMember.findMany).toHaveBeenCalledWith({
      where: { userId: 'u', role: { in: [VehicleRole.editor, VehicleRole.owner] } },
      select: { vehicleId: true },
    });
  });
});
