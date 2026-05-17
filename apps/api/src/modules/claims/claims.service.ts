import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Claim as ClaimRow, Prisma } from '@prisma/client';
import {
  ClaimSchema,
  CreateClaimSchema,
  UpdateClaimSchema,
  type Claim,
  type CreateClaimInput,
  type UpdateClaimInput,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
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

    const row = await this.prisma.claim.create({
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

    const row = await this.prisma.claim.update({
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
    return toClaim(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.claim.delete({ where: { id } });
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
