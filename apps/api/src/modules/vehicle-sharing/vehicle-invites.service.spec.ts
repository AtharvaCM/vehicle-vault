import { createHash } from 'node:crypto';

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VehicleRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleInvitesService } from './vehicle-invites.service';

describe('VehicleInvitesService', () => {
  const prisma = {
    vehicleMember: { findFirst: vi.fn(), upsert: vi.fn() },
    vehicleInvite: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vehicle: { findUniqueOrThrow: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  };
  const access = {
    assert: vi.fn(),
    assertOwner: vi.fn().mockResolvedValue(VehicleRole.owner),
    assertEditor: vi.fn(),
    resolve: vi.fn(),
  };
  const audit = { track: vi.fn().mockResolvedValue(undefined) };
  const mailService = {
    isConfigured: false,
    sendVehicleInviteEmail: vi.fn().mockResolvedValue(undefined),
  };
  const appConfig = { frontendOrigin: 'https://app.test' } as never;

  let service: VehicleInvitesService;

  beforeEach(() => {
    vi.clearAllMocks();
    access.assertOwner.mockResolvedValue(VehicleRole.owner);
    audit.track.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    prisma.vehicle.findUniqueOrThrow.mockResolvedValue({
      id: 'v1',
      make: 'Hyundai',
      model: 'Creta',
      nickname: null,
      registrationNumber: 'MH12AB1234',
    });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ name: 'Owner', email: 'owner@x.test' });
    service = new VehicleInvitesService(
      prisma as never,
      access as never,
      audit as never,
      mailService as never,
      appConfig,
    );
  });

  it('createInvite rejects owner-role grants', async () => {
    await expect(
      service.createInvite('u-owner', 'v1', { email: 'x@x.test', role: VehicleRole.owner }),
    ).rejects.toThrow();
  });

  it('createInvite rejects when target already a member', async () => {
    prisma.vehicleMember.findFirst.mockResolvedValueOnce({ id: 'm1' });
    await expect(
      service.createInvite('u-owner', 'v1', {
        email: 'X@x.test',
        role: VehicleRole.editor,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('createInvite hashes token and creates invite row', async () => {
    prisma.vehicleMember.findFirst.mockResolvedValueOnce(null);
    prisma.vehicleInvite.findFirst.mockResolvedValueOnce(null);
    prisma.vehicleInvite.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'inv-1',
        vehicleId: 'v1',
        email: data.email,
        role: data.role,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        invitedByUserId: data.invitedByUserId,
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await service.createInvite('u-owner', 'v1', {
      email: 'New@x.test',
      role: VehicleRole.viewer,
    });

    expect(result.token).toBeDefined();
    const hash = createHash('sha256').update(result.token!).digest('hex');
    expect(result.invite.email).toBe('new@x.test');
    expect(prisma.vehicleInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tokenHash: hash, role: VehicleRole.viewer }),
    });
  });

  it('accept upserts membership and marks invite accepted', async () => {
    const token = 'a'.repeat(64);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    prisma.vehicleInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      vehicleId: 'v1',
      email: 'new@x.test',
      role: VehicleRole.editor,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
      invitedByUserId: 'u-owner',
      vehicle: { userId: 'u-owner' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ email: 'new@x.test' });
    prisma.vehicleInvite.update.mockResolvedValueOnce({});
    prisma.vehicleMember.upsert.mockResolvedValueOnce({});

    const result = await service.accept('u-new', token);
    expect(result).toEqual({ vehicleId: 'v1', role: VehicleRole.editor });
    expect(prisma.vehicleMember.upsert).toHaveBeenCalledWith({
      where: { vehicleId_userId: { vehicleId: 'v1', userId: 'u-new' } },
      update: { role: VehicleRole.editor },
      create: { vehicleId: 'v1', userId: 'u-new', role: VehicleRole.editor },
    });
  });

  it('accept rejects mismatched email', async () => {
    const token = 'b'.repeat(64);
    prisma.vehicleInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      vehicleId: 'v1',
      email: 'invited@x.test',
      role: VehicleRole.editor,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
      vehicle: { userId: 'u-owner' },
    });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ email: 'other@x.test' });

    await expect(service.accept('u-new', token)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accept rejects expired invite', async () => {
    const token = 'c'.repeat(64);
    prisma.vehicleInvite.findUnique.mockResolvedValueOnce({
      id: 'inv-1',
      vehicleId: 'v1',
      email: 'x@x.test',
      role: VehicleRole.viewer,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() - 60_000),
      acceptedAt: null,
      revokedAt: null,
      vehicle: { userId: 'u-owner' },
    });
    await expect(service.accept('u', token)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accept rejects unknown token', async () => {
    prisma.vehicleInvite.findUnique.mockResolvedValueOnce(null);
    await expect(service.accept('u', 'nope-token')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revoke marks invite revoked', async () => {
    prisma.vehicleInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      vehicleId: 'v1',
      acceptedAt: null,
      revokedAt: null,
    });
    prisma.vehicleInvite.update.mockResolvedValueOnce({ id: 'inv-1', revokedAt: new Date() });
    await service.revoke('u-owner', 'v1', 'inv-1');
    expect(prisma.vehicleInvite.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revoke rejects accepted invite', async () => {
    prisma.vehicleInvite.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      vehicleId: 'v1',
      acceptedAt: new Date(),
      revokedAt: null,
    });
    await expect(service.revoke('u', 'v1', 'inv-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
