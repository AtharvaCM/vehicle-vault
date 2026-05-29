import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType, type Claim as ClaimRow, type Prisma } from '@prisma/client';
import {
  ClaimSchema,
  CreateClaimSchema,
  UpdateClaimSchema,
  type Claim,
  type CreateClaimInput,
  type UpdateClaimInput,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { VehiclesService } from '../vehicles/vehicles.service';

const NOT_FOUND_MESSAGE = 'Claim not found';

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly auditService: AuditService,
  ) {}

  async listForVehicle(userId: string, vehicleId: string): Promise<Claim[]> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const rows = await this.prisma.claim.findMany({
      where: { insurancePolicy: { vehicleId } },
      orderBy: { filedDate: 'desc' },
    });
    return rows.map(toClaim);
  }

  async create(userId: string, vehicleId: string, payload: CreateClaimInput): Promise<Claim> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const input = CreateClaimSchema.parse(payload);

    await this.ensurePolicyBelongsToVehicle(input.insurancePolicyId, vehicleId);
    if (input.maintenanceRecordId) {
      await this.ensureMaintenanceRecordBelongsToVehicle(input.maintenanceRecordId, vehicleId);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.claim.create({
        data: {
          insurancePolicyId: input.insurancePolicyId,
          maintenanceRecordId: input.maintenanceRecordId ?? null,
          claimNumber: input.claimNumber ?? null,
          grossAmount: input.grossAmount,
          insurerPaidAmount: input.insurerPaidAmount,
          status: input.status,
          filedDate: input.filedDate,
          settledDate: input.settledDate ?? null,
          notes: input.notes ?? null,
        },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.claim.created,
        resourceType: AuditResourceType.claim,
        resourceId: created.id,
        after: created as unknown as Record<string, unknown>,
      });
      return created;
    });
    return toClaim(row);
  }

  async update(userId: string, id: string, payload: UpdateClaimInput): Promise<Claim> {
    const input = UpdateClaimSchema.parse(payload);
    const owned = await this.findOwned(userId, id);

    if (
      input.maintenanceRecordId !== undefined &&
      input.maintenanceRecordId !== null
    ) {
      await this.ensureMaintenanceRecordBelongsToVehicle(
        input.maintenanceRecordId,
        owned.insurancePolicy.vehicleId,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.claim.update({
        where: { id },
        data: {
          ...(input.maintenanceRecordId !== undefined
            ? { maintenanceRecordId: input.maintenanceRecordId }
            : {}),
          ...(input.claimNumber !== undefined ? { claimNumber: input.claimNumber } : {}),
          ...(input.grossAmount !== undefined ? { grossAmount: input.grossAmount } : {}),
          ...(input.insurerPaidAmount !== undefined
            ? { insurerPaidAmount: input.insurerPaidAmount }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.filedDate !== undefined ? { filedDate: input.filedDate } : {}),
          ...(input.settledDate !== undefined ? { settledDate: input.settledDate } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.claim.updated,
        resourceType: AuditResourceType.claim,
        resourceId: id,
        before: owned as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    });
    return toClaim(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const before = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.claim.delete({ where: { id } });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.claim.deleted,
        resourceType: AuditResourceType.claim,
        resourceId: id,
        before: before as unknown as Record<string, unknown>,
      });
    });
  }

  private async findOwned(userId: string, id: string) {
    const row = await this.prisma.claim.findUnique({
      where: { id },
      include: {
        insurancePolicy: {
          select: {
            vehicleId: true,
            vehicle: { select: { userId: true } },
          },
        },
      },
    });
    if (!row || row.insurancePolicy.vehicle.userId !== userId) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return row;
  }

  private async ensurePolicyBelongsToVehicle(policyId: string, vehicleId: string): Promise<void> {
    const policy = await this.prisma.insurancePolicy.findUnique({
      where: { id: policyId },
      select: { vehicleId: true },
    });
    if (!policy || policy.vehicleId !== vehicleId) {
      throw new BadRequestException(
        'Insurance policy does not belong to this vehicle.',
      );
    }
  }

  private async ensureMaintenanceRecordBelongsToVehicle(
    recordId: string,
    vehicleId: string,
  ): Promise<void> {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { id: recordId },
      select: { vehicleId: true },
    });
    if (!record || record.vehicleId !== vehicleId) {
      throw new BadRequestException(
        'Maintenance record does not belong to this vehicle.',
      );
    }
  }
}

function toClaim(row: ClaimRow): Claim {
  return ClaimSchema.parse({
    id: row.id,
    insurancePolicyId: row.insurancePolicyId,
    maintenanceRecordId: row.maintenanceRecordId,
    claimNumber: row.claimNumber,
    grossAmount: decimalToNumber(row.grossAmount),
    insurerPaidAmount: decimalToNumber(row.insurerPaidAmount),
    status: row.status,
    filedDate: row.filedDate.toISOString(),
    settledDate: row.settledDate?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
