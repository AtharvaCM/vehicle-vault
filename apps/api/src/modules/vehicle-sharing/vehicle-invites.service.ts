import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditResourceType, Prisma, VehicleRole } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';

const INVITE_TOKEN_BYTES = 32;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired' | 'declined';

export interface InviteCreateResult {
  invite: SerialisedInvite;
  /**
   * The link to accept, always: the owner can forward it themselves, which is
   * the only way it reaches anyone while email is not configured.
   */
  acceptUrl: string;
  /** True only when an email really went out. */
  emailSent: boolean;
}

export interface InvitePreview {
  status: InviteStatus;
  vehicleLabel: string;
  inviterName: string;
  role: VehicleRole;
  emailMasked: string;
  expiresAt: string;
  addressedToYou?: boolean;
}

export interface SerialisedInvite {
  id: string;
  vehicleId: string;
  email: string;
  role: VehicleRole;
  status: InviteStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  declinedAt: string | null;
  invitedByUserId: string;
  createdAt: string;
}

@Injectable()
export class VehicleInvitesService {
  private readonly logger = new Logger(VehicleInvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VehicleAccessService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly appConfig: AppConfigService,
  ) {}

  async createInvite(
    actorUserId: string,
    vehicleId: string,
    payload: { email: string; role: VehicleRole },
  ): Promise<InviteCreateResult> {
    await this.access.assertOwner(actorUserId, vehicleId);

    if (payload.role === VehicleRole.owner) {
      throw new BadRequestException('Use transfer-ownership to grant the owner role.');
    }

    const normalisedEmail = payload.email.trim().toLowerCase();

    const existingMember = await this.prisma.vehicleMember.findFirst({
      where: { vehicleId, user: { email: normalisedEmail } },
      select: { id: true },
    });
    if (existingMember) {
      throw new ConflictException('That user already has access to this vehicle.');
    }

    const existingInvite = await this.prisma.vehicleInvite.findFirst({
      where: {
        vehicleId,
        email: normalisedEmail,
        acceptedAt: null,
        revokedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (existingInvite) {
      throw new ConflictException('An active invitation already exists for that email.');
    }

    const token = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const vehicle = await this.prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
      select: { id: true, make: true, model: true, nickname: true, registrationNumber: true },
    });
    const inviter = await this.prisma.user.findUniqueOrThrow({
      where: { id: actorUserId },
      select: { name: true },
    });

    const invite = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vehicleInvite.create({
        data: {
          vehicleId,
          email: normalisedEmail,
          role: payload.role,
          tokenHash,
          expiresAt,
          invitedByUserId: actorUserId,
        },
      });
      await this.auditService.track(tx, {
        actorUserId,
        ownerUserId: actorUserId,
        action: AUDIT_ACTIONS.vehicleInvite.created,
        resourceType: AuditResourceType.vehicle_invite,
        resourceId: created.id,
        after: created as unknown as Record<string, unknown>,
      });
      return created;
    });

    const acceptUrl = this.buildAcceptUrl(token);
    let emailSent = false;
    if (this.mailService.isConfigured) {
      try {
        await this.mailService.sendVehicleInviteEmail({
          email: normalisedEmail,
          inviterName: inviter.name,
          vehicleLabel: labelForVehicle(vehicle),
          role: payload.role,
          acceptUrl,
          expiresAt,
        });
        emailSent = true;
      } catch (error) {
        this.logger.warn(
          `Invite email delivery failed for ${normalisedEmail}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return { invite: serialiseInvite(invite), acceptUrl, emailSent };
  }

  /**
   * The invite behind a link, for its page to show before anyone accepts:
   * vehicle, inviter, role, the invited address masked, expiry and status.
   * Anyone holding the link may see this (the token is the secret). With a
   * `userId`, it also says whether the invite is addressed to that account.
   */
  async preview(token: string, userId?: string): Promise<InvitePreview> {
    const invite = await this.prisma.vehicleInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        vehicle: {
          select: { make: true, model: true, nickname: true, registrationNumber: true },
        },
        invitedBy: { select: { name: true } },
      },
    });
    if (!invite) throw new NotFoundException('Invitation not found.');

    let addressedToYou: boolean | undefined;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      addressedToYou = user?.email.toLowerCase() === invite.email.toLowerCase();
    }

    return {
      status: computeInviteStatus(invite),
      vehicleLabel: labelForVehicle(invite.vehicle),
      inviterName: invite.invitedBy.name,
      role: invite.role,
      emailMasked: maskEmail(invite.email),
      expiresAt: invite.expiresAt.toISOString(),
      ...(addressedToYou === undefined ? {} : { addressedToYou }),
    };
  }

  /**
   * The invitee says no. Only the account the invite is addressed to can
   * decline it, and only while it is pending; the owner sees it as declined.
   */
  async decline(userId: string, token: string): Promise<{ declined: true }> {
    const invite = await this.findUsableInvite(userId, token);

    await this.prisma.$transaction(async (tx) => {
      const declined = await tx.vehicleInvite.update({
        where: { id: invite.id },
        data: { declinedAt: new Date() },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: invite.vehicle.userId,
        action: AUDIT_ACTIONS.vehicleInvite.declined,
        resourceType: AuditResourceType.vehicle_invite,
        resourceId: invite.id,
        before: invite as unknown as Record<string, unknown>,
        after: declined as unknown as Record<string, unknown>,
      });
    });

    return { declined: true };
  }

  async listForVehicle(actorUserId: string, vehicleId: string): Promise<SerialisedInvite[]> {
    await this.access.assertOwner(actorUserId, vehicleId);
    const invites = await this.prisma.vehicleInvite.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map(serialiseInvite);
  }

  /**
   * A fresh link for a pending invite, since the token is only ever known at
   * creation (the row keeps its hash, not the token itself). Rotating it
   * invalidates whatever link was handed out before, and tries mail again
   * exactly like `createInvite` does.
   */
  async resend(
    actorUserId: string,
    vehicleId: string,
    inviteId: string,
  ): Promise<InviteCreateResult> {
    await this.access.assertOwner(actorUserId, vehicleId);
    const invite = await this.prisma.vehicleInvite.findFirst({
      where: { id: inviteId, vehicleId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (computeInviteStatus(invite) !== 'pending') {
      throw new ConflictException('Only a pending invitation can be resent.');
    }

    const token = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const vehicle = await this.prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
      select: { make: true, model: true, nickname: true, registrationNumber: true },
    });
    const inviter = await this.prisma.user.findUniqueOrThrow({
      where: { id: actorUserId },
      select: { name: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.vehicleInvite.update({
        where: { id: inviteId },
        data: { tokenHash, expiresAt },
      });
      await this.auditService.track(tx, {
        actorUserId,
        ownerUserId: actorUserId,
        action: AUDIT_ACTIONS.vehicleInvite.resent,
        resourceType: AuditResourceType.vehicle_invite,
        resourceId: inviteId,
        before: invite as unknown as Record<string, unknown>,
        after: result as unknown as Record<string, unknown>,
      });
      return result;
    });

    const acceptUrl = this.buildAcceptUrl(token);
    let emailSent = false;
    if (this.mailService.isConfigured) {
      try {
        await this.mailService.sendVehicleInviteEmail({
          email: updated.email,
          inviterName: inviter.name,
          vehicleLabel: labelForVehicle(vehicle),
          role: updated.role,
          acceptUrl,
          expiresAt,
        });
        emailSent = true;
      } catch (error) {
        this.logger.warn(
          `Resend invite email delivery failed for ${updated.email}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return { invite: serialiseInvite(updated), acceptUrl, emailSent };
  }

  async revoke(actorUserId: string, vehicleId: string, inviteId: string): Promise<void> {
    await this.access.assertOwner(actorUserId, vehicleId);
    const invite = await this.prisma.vehicleInvite.findFirst({
      where: { id: inviteId, vehicleId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.acceptedAt) {
      throw new ConflictException('Cannot revoke an already-accepted invitation.');
    }
    if (invite.revokedAt) return;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicleInvite.update({
        where: { id: inviteId },
        data: { revokedAt: new Date() },
      });
      await this.auditService.track(tx, {
        actorUserId,
        ownerUserId: actorUserId,
        action: AUDIT_ACTIONS.vehicleInvite.revoked,
        resourceType: AuditResourceType.vehicle_invite,
        resourceId: inviteId,
        before: invite as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
    });
  }

  async accept(userId: string, token: string): Promise<{ vehicleId: string; role: VehicleRole }> {
    const invite = await this.findUsableInvite(userId, token);

    if (invite.vehicle.userId === userId) {
      throw new ConflictException('You already own this vehicle.');
    }

    await this.prisma.$transaction(async (tx) => {
      const acceptedInvite = await tx.vehicleInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      // Upsert membership in case the user was already a member at a different role.
      await tx.vehicleMember.upsert({
        where: { vehicleId_userId: { vehicleId: invite.vehicleId, userId } },
        update: { role: invite.role },
        create: { vehicleId: invite.vehicleId, userId, role: invite.role },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: invite.vehicle.userId,
        action: AUDIT_ACTIONS.vehicleInvite.accepted,
        resourceType: AuditResourceType.vehicle_invite,
        resourceId: invite.id,
        before: invite as unknown as Record<string, unknown>,
        after: acceptedInvite as unknown as Record<string, unknown>,
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: invite.vehicle.userId,
        action: AUDIT_ACTIONS.vehicleMember.added,
        resourceType: AuditResourceType.vehicle_member,
        resourceId: invite.vehicleId,
        after: {
          vehicleId: invite.vehicleId,
          userId,
          role: invite.role,
        },
      });
    });

    return { vehicleId: invite.vehicleId, role: invite.role };
  }

  /** A pending invite addressed to this account, or the reason it cannot be used. */
  private async findUsableInvite(userId: string, token: string) {
    const invite = await this.prisma.vehicleInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { vehicle: { select: { userId: true } } },
    });
    if (!invite) throw new NotFoundException('Invitation not found.');
    if (invite.acceptedAt) throw new ConflictException('Invitation already accepted.');
    if (invite.revokedAt) throw new ForbiddenException('Invitation was revoked.');
    if (invite.declinedAt) throw new ForbiddenException('Invitation was declined.');
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('Invitation has expired.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('This invitation is addressed to a different account.');
    }

    return invite;
  }

  private buildAcceptUrl(token: string) {
    const base = this.appConfig.frontendOrigin.replace(/\/$/, '');
    return `${base}/vehicle-invites/${token}`;
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function labelForVehicle(v: {
  make: string;
  model: string;
  nickname: string | null;
  registrationNumber: string;
}) {
  if (v.nickname) return `${v.nickname} (${v.registrationNumber})`;
  return `${v.make} ${v.model} (${v.registrationNumber})`;
}

/** `rahul@gmail.com` → `r***@gmail.com`: enough to recognise, not to harvest. */
export function maskEmail(email: string) {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

function serialiseInvite(invite: Prisma.VehicleInviteGetPayload<true>): SerialisedInvite {
  return {
    id: invite.id,
    vehicleId: invite.vehicleId,
    email: invite.email,
    role: invite.role,
    status: computeInviteStatus(invite),
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
    revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
    declinedAt: invite.declinedAt ? invite.declinedAt.toISOString() : null,
    invitedByUserId: invite.invitedByUserId,
    createdAt: invite.createdAt.toISOString(),
  };
}

function computeInviteStatus(invite: Prisma.VehicleInviteGetPayload<true>): InviteStatus {
  if (invite.acceptedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  if (invite.declinedAt) return 'declined';
  if (invite.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'pending';
}
