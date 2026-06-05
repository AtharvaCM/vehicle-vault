import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditResourceType, VehicleRole } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';

export interface SerialisedMember {
  id: string;
  vehicleId: string;
  userId: string;
  email: string;
  name: string;
  role: VehicleRole;
  createdAt: string;
  isSelf: boolean;
}

@Injectable()
export class VehicleMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VehicleAccessService,
    private readonly auditService: AuditService,
  ) {}

  async list(actorUserId: string, vehicleId: string): Promise<SerialisedMember[]> {
    await this.access.assert(actorUserId, vehicleId);
    const rows = await this.prisma.vehicleMember.findMany({
      where: { vehicleId },
      include: { user: { select: { email: true, name: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      userId: row.userId,
      email: row.user.email,
      name: row.user.name,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      isSelf: row.userId === actorUserId,
    }));
  }

  async updateRole(
    actorUserId: string,
    vehicleId: string,
    memberId: string,
    role: VehicleRole,
  ): Promise<SerialisedMember> {
    await this.access.assertOwner(actorUserId, vehicleId);
    if (role === VehicleRole.owner) {
      throw new BadRequestException('Use transfer-ownership to grant the owner role.');
    }

    const member = await this.prisma.vehicleMember.findFirst({
      where: { id: memberId, vehicleId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!member) throw new NotFoundException('Member not found');

    if (member.role === VehicleRole.owner) {
      throw new ConflictException('Cannot change the owner role here; transfer ownership first.');
    }

    if (member.role === role) {
      return toSerialised(member, actorUserId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.vehicleMember.update({
        where: { id: memberId },
        data: { role },
        include: { user: { select: { email: true, name: true } } },
      });
      await this.auditService.track(tx, {
        actorUserId,
        ownerUserId: actorUserId,
        action: AUDIT_ACTIONS.vehicleMember.roleChanged,
        resourceType: AuditResourceType.vehicle_member,
        resourceId: memberId,
        before: { role: member.role },
        after: { role: next.role },
      });
      return next;
    });

    return toSerialised(updated, actorUserId);
  }

  async remove(actorUserId: string, vehicleId: string, memberId: string): Promise<void> {
    const member = await this.prisma.vehicleMember.findFirst({
      where: { id: memberId, vehicleId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const isSelf = member.userId === actorUserId;
    if (!isSelf) {
      // Removing someone else requires owner privileges.
      await this.access.assertOwner(actorUserId, vehicleId);
    } else {
      // Self-leave requires at least viewer access (it always exists if the row matches).
      await this.access.assert(actorUserId, vehicleId);
    }

    if (member.role === VehicleRole.owner) {
      throw new ConflictException(
        'Owners cannot be removed. Transfer ownership first, or delete the vehicle.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicleMember.delete({ where: { id: memberId } });
      await this.auditService.track(tx, {
        actorUserId,
        ownerUserId: actorUserId,
        action: AUDIT_ACTIONS.vehicleMember.removed,
        resourceType: AuditResourceType.vehicle_member,
        resourceId: memberId,
        before: member as unknown as Record<string, unknown>,
      });
    });
  }

  async transferOwnership(
    actorUserId: string,
    vehicleId: string,
    targetMemberId: string,
  ): Promise<void> {
    await this.access.assertOwner(actorUserId, vehicleId);

    const target = await this.prisma.vehicleMember.findFirst({
      where: { id: targetMemberId, vehicleId },
    });
    if (!target) throw new NotFoundException('Target member not found');
    if (target.userId === actorUserId) {
      throw new BadRequestException('You already own this vehicle.');
    }

    const currentOwner = await this.prisma.vehicleMember.findFirst({
      where: { vehicleId, userId: actorUserId, role: VehicleRole.owner },
    });
    if (!currentOwner) {
      // Defensive — assertOwner above should have caught this.
      throw new ForbiddenException('You are not the owner of this vehicle.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicleMember.update({
        where: { id: currentOwner.id },
        data: { role: VehicleRole.editor },
      });
      await tx.vehicleMember.update({
        where: { id: target.id },
        data: { role: VehicleRole.owner },
      });
      // Canonical owner pointer follows the role transfer.
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { userId: target.userId },
      });
      await this.auditService.track(tx, {
        actorUserId,
        ownerUserId: target.userId,
        action: AUDIT_ACTIONS.vehicleMember.ownershipTransferred,
        resourceType: AuditResourceType.vehicle_member,
        resourceId: vehicleId,
        before: { ownerUserId: actorUserId },
        after: { ownerUserId: target.userId },
      });
    });
  }
}

function toSerialised(
  row: {
    id: string;
    vehicleId: string;
    userId: string;
    role: VehicleRole;
    createdAt: Date;
    user: { email: string; name: string };
  },
  actorUserId: string,
): SerialisedMember {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    userId: row.userId,
    email: row.user.email,
    name: row.user.name,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    isSelf: row.userId === actorUserId,
  };
}
