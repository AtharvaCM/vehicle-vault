import { Injectable } from '@nestjs/common';
import type { InsurancePolicy, Prisma } from '@prisma/client';
import type {
  CreateVehicleDocumentInput,
  UpdateVehicleDocumentInput,
  VehicleDocument,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { VehicleDocumentAdapter } from '../types';

function decimalToNumberOrNull(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

@Injectable()
export class InsuranceAdapter implements VehicleDocumentAdapter {
  readonly kind = 'insurance' as const;

  constructor(private readonly prisma: PrismaService) {}

  async listForVehicle(vehicleId: string): Promise<VehicleDocument[]> {
    const rows = await this.prisma.insurancePolicy.findMany({
      where: { vehicleId },
      orderBy: { endDate: 'desc' },
    });
    return rows.map((row) => this.toDocument(row));
  }

  async findForOwnerCheck(
    id: string,
  ): Promise<{ document: VehicleDocument; vehicleUserId: string } | null> {
    const row = await this.prisma.insurancePolicy.findUnique({
      where: { id },
      include: { vehicle: { select: { userId: true } } },
    });
    if (!row) return null;
    const { vehicle, ...policy } = row;
    return {
      document: this.toDocument(policy),
      vehicleUserId: vehicle.userId,
    };
  }

  async activeAt(vehicleId: string, date: Date): Promise<VehicleDocument[]> {
    const rows = await this.prisma.insurancePolicy.findMany({
      where: {
        vehicleId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: { endDate: 'desc' },
    });
    return rows.map((row) => this.toDocument(row));
  }

  async findExpiringBetween(
    userId: string,
    from: Date,
    until: Date,
  ): Promise<VehicleDocument[]> {
    const rows = await this.prisma.insurancePolicy.findMany({
      where: {
        vehicle: { members: { some: { userId } } },
        endDate: { gte: from, lte: until },
      },
      orderBy: { endDate: 'asc' },
    });
    return rows.map((row) => this.toDocument(row));
  }

  async create(
    vehicleId: string,
    input: Extract<CreateVehicleDocumentInput, { kind: 'insurance' }>,
  ): Promise<VehicleDocument> {
    const row = await this.prisma.insurancePolicy.create({
      data: {
        vehicleId,
        provider: input.provider,
        policyNumber: input.policyNumber,
        startDate: input.startDate,
        endDate: input.endDate,
        premiumAmount: input.premiumAmount ?? null,
        insuredValue: input.insuredValue ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.toDocument(row);
  }

  async update(
    id: string,
    input: Extract<UpdateVehicleDocumentInput, { kind: 'insurance' }>,
  ): Promise<VehicleDocument> {
    const { kind: _kind, ...data } = input;
    void _kind;
    const row = await this.prisma.insurancePolicy.update({
      where: { id },
      data,
    });
    return this.toDocument(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.insurancePolicy.delete({ where: { id } });
  }

  toDocument(row: InsurancePolicy): VehicleDocument {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      kind: 'insurance',
      provider: row.provider,
      number: row.policyNumber,
      startDate: row.startDate,
      endDate: row.endDate,
      notes: row.notes,
      details: {
        premiumAmount: decimalToNumberOrNull(row.premiumAmount),
        insuredValue: decimalToNumberOrNull(row.insuredValue),
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
