import { createHash } from 'node:crypto';

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VehicleRole } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { maskEmail, VehicleInvitesService } from './vehicle-invites.service';

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
    user: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn() },
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

    // The owner always gets the link, and it carries the token the row hashes.
    const token = result.acceptUrl.replace('https://app.test/vehicle-invites/', '');
    expect(result.acceptUrl).toMatch(/^https:\/\/app\.test\/vehicle-invites\/[0-9a-f]{64}$/);
    const hash = createHash('sha256').update(token).digest('hex');
    expect(result.invite.email).toBe('new@x.test');
    // Mail is not configured here, so nothing claims an email went out.
    expect(result.emailSent).toBe(false);
    expect(mailService.sendVehicleInviteEmail).not.toHaveBeenCalled();
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

  describe('email delivery is reported, not assumed', () => {
    function stubCreate() {
      prisma.vehicleMember.findFirst.mockResolvedValueOnce(null);
      prisma.vehicleInvite.findFirst.mockResolvedValueOnce(null);
      prisma.vehicleInvite.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'inv-1',
            vehicleId: 'v1',
            ...data,
            acceptedAt: null,
            revokedAt: null,
            declinedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      );
    }

    afterEach(() => {
      mailService.isConfigured = false;
    });

    it('says an email was sent when it was', async () => {
      mailService.isConfigured = true;
      stubCreate();

      const result = await service.createInvite('u-owner', 'v1', {
        email: 'new@x.test',
        role: VehicleRole.editor,
      });

      expect(result.emailSent).toBe(true);
      expect(mailService.sendVehicleInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({ acceptUrl: result.acceptUrl }),
      );
    });

    it('says no email was sent when delivery failed, and still gives the link', async () => {
      mailService.isConfigured = true;
      mailService.sendVehicleInviteEmail.mockRejectedValueOnce(new Error('SMTP down'));
      stubCreate();

      const result = await service.createInvite('u-owner', 'v1', {
        email: 'new@x.test',
        role: VehicleRole.editor,
      });

      expect(result.emailSent).toBe(false);
      expect(result.acceptUrl).toMatch(/\/vehicle-invites\//);
    });
  });

  describe('preview', () => {
    const token = 'd'.repeat(64);
    const stored = (overrides: Record<string, unknown> = {}) => ({
      id: 'inv-1',
      vehicleId: 'v1',
      email: 'rahul@gmail.com',
      role: VehicleRole.viewer,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
      declinedAt: null,
      invitedByUserId: 'u-owner',
      vehicle: {
        make: 'Hyundai',
        model: 'Creta',
        nickname: 'Family SUV',
        registrationNumber: 'MH12AB1234',
      },
      invitedBy: { name: 'Asha' },
      ...overrides,
    });

    it('shows vehicle, inviter, role, masked address and expiry to anyone with the link', async () => {
      prisma.vehicleInvite.findUnique.mockResolvedValueOnce(stored());

      await expect(service.preview(token)).resolves.toEqual({
        status: 'pending',
        vehicleLabel: 'Family SUV (MH12AB1234)',
        inviterName: 'Asha',
        role: VehicleRole.viewer,
        emailMasked: 'r***@gmail.com',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('says, signed in, whether the invite is for this account', async () => {
      prisma.vehicleInvite.findUnique.mockResolvedValue(stored());
      prisma.user.findUnique.mockResolvedValueOnce({ email: 'Rahul@Gmail.com' });

      await expect(service.preview(token, 'u-rahul')).resolves.toMatchObject({
        addressedToYou: true,
      });

      prisma.user.findUnique.mockResolvedValueOnce({ email: 'someone@else.test' });

      await expect(service.preview(token, 'u-other')).resolves.toMatchObject({
        addressedToYou: false,
      });
    });

    it('reports an invite that has ended', async () => {
      prisma.vehicleInvite.findUnique.mockResolvedValueOnce(stored({ declinedAt: new Date() }));

      await expect(service.preview(token)).resolves.toMatchObject({ status: 'declined' });
    });

    it('404s an unknown link', async () => {
      prisma.vehicleInvite.findUnique.mockResolvedValueOnce(null);

      await expect(service.preview('nope-token-nope-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('decline', () => {
    const token = 'e'.repeat(64);
    const pending = {
      id: 'inv-1',
      vehicleId: 'v1',
      email: 'new@x.test',
      role: VehicleRole.editor,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
      declinedAt: null,
      vehicle: { userId: 'u-owner' },
    };

    it('marks the invite declined, audited for the owner', async () => {
      prisma.vehicleInvite.findUnique.mockResolvedValueOnce(pending);
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ email: 'new@x.test' });
      prisma.vehicleInvite.update.mockResolvedValueOnce({ ...pending, declinedAt: new Date() });

      await expect(service.decline('u-new', token)).resolves.toEqual({ declined: true });
      expect(prisma.vehicleInvite.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { declinedAt: expect.any(Date) },
      });
      expect(audit.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'vehicle_invite.declined', ownerUserId: 'u-owner' }),
      );
      expect(prisma.vehicleMember.upsert).not.toHaveBeenCalled();
    });

    it('only lets the invited account decline', async () => {
      prisma.vehicleInvite.findUnique.mockResolvedValueOnce(pending);
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ email: 'other@x.test' });

      await expect(service.decline('u-other', token)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.vehicleInvite.update).not.toHaveBeenCalled();
    });

    it('cannot accept an invite once declined', async () => {
      prisma.vehicleInvite.findUnique.mockResolvedValueOnce({
        ...pending,
        declinedAt: new Date(),
      });

      await expect(service.accept('u-new', token)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('masks an address to its first letter and domain', () => {
    expect(maskEmail('rahul@gmail.com')).toBe('r***@gmail.com');
    expect(maskEmail('a@b.test')).toBe('a***@b.test');
    expect(maskEmail('not-an-email')).toBe('***');
  });
});
