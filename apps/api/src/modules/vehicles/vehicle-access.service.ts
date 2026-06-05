import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VehicleRole } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const ROLE_RANK: Record<VehicleRole, number> = {
  [VehicleRole.viewer]: 1,
  [VehicleRole.editor]: 2,
  [VehicleRole.owner]: 3,
};

@Injectable()
export class VehicleAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the user's role on this vehicle, or null when no membership exists. */
  async resolve(
    userId: string,
    vehicleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<VehicleRole | null> {
    const client = tx ?? this.prisma;
    const member = await client.vehicleMember.findUnique({
      where: { vehicleId_userId: { vehicleId, userId } },
      select: { role: true },
    });
    return member?.role ?? null;
  }

  /**
   * Asserts the user has at least `min` access to the vehicle.
   * Throws NotFound when no membership row exists so non-members cannot probe vehicle ids.
   * Throws Forbidden when the role is below the minimum.
   */
  async assert(
    userId: string,
    vehicleId: string,
    min: VehicleRole = VehicleRole.viewer,
    tx?: Prisma.TransactionClient,
  ): Promise<VehicleRole> {
    const role = await this.resolve(userId, vehicleId, tx);
    if (!role) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }
    if (ROLE_RANK[role] < ROLE_RANK[min]) {
      throw new ForbiddenException(
        `This action requires the '${min}' role on this vehicle.`,
      );
    }
    return role;
  }

  async assertOwner(userId: string, vehicleId: string, tx?: Prisma.TransactionClient) {
    return this.assert(userId, vehicleId, VehicleRole.owner, tx);
  }

  async assertEditor(userId: string, vehicleId: string, tx?: Prisma.TransactionClient) {
    return this.assert(userId, vehicleId, VehicleRole.editor, tx);
  }

  /** Vehicle ids the user has at least `min` access to. */
  async listAccessibleVehicleIds(
    userId: string,
    min: VehicleRole = VehicleRole.viewer,
  ): Promise<string[]> {
    const rows = await this.prisma.vehicleMember.findMany({
      where: { userId, role: { in: rolesAtLeast(min) } },
      select: { vehicleId: true },
    });
    return rows.map((r) => r.vehicleId);
  }
}

function rolesAtLeast(min: VehicleRole): VehicleRole[] {
  const minRank = ROLE_RANK[min];
  return (Object.keys(ROLE_RANK) as VehicleRole[]).filter(
    (role) => ROLE_RANK[role] >= minRank,
  );
}
