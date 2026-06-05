import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { VehicleRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleMembersService } from './vehicle-members.service';

describe('VehicleMembersService', () => {
  const prisma = {
    vehicleMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vehicle: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  const access = {
    assert: vi.fn().mockResolvedValue(VehicleRole.owner),
    assertOwner: vi.fn().mockResolvedValue(VehicleRole.owner),
    assertEditor: vi.fn().mockResolvedValue(VehicleRole.owner),
    resolve: vi.fn(),
  };
  const audit = { track: vi.fn().mockResolvedValue(undefined) };

  let service: VehicleMembersService;

  beforeEach(() => {
    vi.clearAllMocks();
    access.assert.mockResolvedValue(VehicleRole.owner);
    access.assertOwner.mockResolvedValue(VehicleRole.owner);
    audit.track.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    service = new VehicleMembersService(prisma as never, access as never, audit as never);
  });

  it('list returns members with isSelf flag', async () => {
    prisma.vehicleMember.findMany.mockResolvedValueOnce([
      {
        id: 'm1',
        vehicleId: 'v1',
        userId: 'u1',
        role: VehicleRole.owner,
        createdAt: new Date('2026-06-01'),
        user: { email: 'a@x.test', name: 'A' },
      },
      {
        id: 'm2',
        vehicleId: 'v1',
        userId: 'u2',
        role: VehicleRole.editor,
        createdAt: new Date('2026-06-02'),
        user: { email: 'b@x.test', name: 'B' },
      },
    ]);
    const result = await service.list('u1', 'v1');
    expect(result[0]?.isSelf).toBe(true);
    expect(result[1]?.isSelf).toBe(false);
    expect(access.assert).toHaveBeenCalledWith('u1', 'v1');
  });

  it('updateRole rejects when target is owner', async () => {
    prisma.vehicleMember.findFirst.mockResolvedValueOnce({
      id: 'm1',
      vehicleId: 'v1',
      userId: 'u-owner',
      role: VehicleRole.owner,
      createdAt: new Date(),
      user: { email: 'o@x.test', name: 'O' },
    });
    await expect(
      service.updateRole('u1', 'v1', 'm1', VehicleRole.editor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updateRole rejects promotion to owner role', async () => {
    await expect(
      service.updateRole('u1', 'v1', 'm1', VehicleRole.owner),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove rejects owner removal', async () => {
    prisma.vehicleMember.findFirst.mockResolvedValueOnce({
      id: 'm1',
      vehicleId: 'v1',
      userId: 'u-owner',
      role: VehicleRole.owner,
    });
    await expect(service.remove('u-owner', 'v1', 'm1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('remove allows self-leave for non-owner', async () => {
    prisma.vehicleMember.findFirst.mockResolvedValueOnce({
      id: 'm2',
      vehicleId: 'v1',
      userId: 'u2',
      role: VehicleRole.editor,
    });
    prisma.vehicleMember.delete.mockResolvedValueOnce({});
    await expect(service.remove('u2', 'v1', 'm2')).resolves.toBeUndefined();
    expect(access.assertOwner).not.toHaveBeenCalled();
    expect(prisma.vehicleMember.delete).toHaveBeenCalledWith({ where: { id: 'm2' } });
  });

  it('transferOwnership swaps roles and updates Vehicle.userId', async () => {
    prisma.vehicleMember.findFirst
      .mockResolvedValueOnce({ id: 'm-target', vehicleId: 'v1', userId: 'u2', role: VehicleRole.editor })
      .mockResolvedValueOnce({ id: 'm-self', vehicleId: 'v1', userId: 'u1', role: VehicleRole.owner });
    prisma.vehicleMember.update.mockResolvedValue({});
    prisma.vehicle.update.mockResolvedValue({});
    await service.transferOwnership('u1', 'v1', 'm-target');
    expect(prisma.vehicleMember.update).toHaveBeenCalledWith({
      where: { id: 'm-self' },
      data: { role: VehicleRole.editor },
    });
    expect(prisma.vehicleMember.update).toHaveBeenCalledWith({
      where: { id: 'm-target' },
      data: { role: VehicleRole.owner },
    });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { userId: 'u2' },
    });
  });

  it('transferOwnership rejects when target missing', async () => {
    prisma.vehicleMember.findFirst.mockResolvedValueOnce(null);
    await expect(service.transferOwnership('u1', 'v1', 'm-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('transferOwnership rejects self-transfer', async () => {
    prisma.vehicleMember.findFirst.mockResolvedValueOnce({
      id: 'm1',
      vehicleId: 'v1',
      userId: 'u1',
      role: VehicleRole.owner,
    });
    await expect(service.transferOwnership('u1', 'v1', 'm1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
