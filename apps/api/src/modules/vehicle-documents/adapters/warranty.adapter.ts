import { Injectable } from '@nestjs/common';
import type { Warranty } from '@prisma/client';
import type {
  CreateVehicleDocumentInput,
  UpdateVehicleDocumentInput,
  VehicleDocument,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { VehicleDocumentAdapter } from '../types';

@Injectable()
export class WarrantyAdapter implements VehicleDocumentAdapter {
  readonly kind = 'warranty' as const;

  constructor(private readonly prisma: PrismaService) {}

  async listForVehicle(vehicleId: string): Promise<VehicleDocument[]> {
    const rows = await this.prisma.warranty.findMany({
      where: { vehicleId },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => this.toDocument(row));
  }

  async findForOwnerCheck(
    id: string,
  ): Promise<{ document: VehicleDocument; vehicleUserId: string } | null> {
    const row = await this.prisma.warranty.findUnique({
      where: { id },
      include: { vehicle: { select: { userId: true } } },
    });
    if (!row) return null;
    const { vehicle, ...warranty } = row;
    return {
      document: this.toDocument(warranty),
      vehicleUserId: vehicle.userId,
    };
  }

  async activeAt(vehicleId: string, date: Date): Promise<VehicleDocument[]> {
    const rows = await this.prisma.warranty.findMany({
      where: {
        vehicleId,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => this.toDocument(row));
  }

  async findExpiringBetween(
    userId: string,
    from: Date,
    until: Date,
  ): Promise<VehicleDocument[]> {
    // Warranties with a null endDate never expire, so they're excluded here.
    const rows = await this.prisma.warranty.findMany({
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
    input: Extract<CreateVehicleDocumentInput, { kind: 'warranty' }>,
  ): Promise<VehicleDocument> {
    const row = await this.prisma.warranty.create({
      data: {
        vehicleId,
        provider: input.provider,
        warrantyNumber: input.warrantyNumber ?? null,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        endOdometer: input.endOdometer ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.toDocument(row);
  }

  async update(
    id: string,
    input: Extract<UpdateVehicleDocumentInput, { kind: 'warranty' }>,
  ): Promise<VehicleDocument> {
    const { kind: _kind, ...data } = input;
    void _kind;
    const row = await this.prisma.warranty.update({
      where: { id },
      data,
    });
    return this.toDocument(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.warranty.delete({ where: { id } });
  }

  toDocument(row: Warranty): VehicleDocument {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      kind: 'warranty',
      provider: row.provider,
      number: row.warrantyNumber,
      startDate: row.startDate,
      endDate: row.endDate,
      notes: row.notes,
      details: {
        type: row.type,
        endOdometer: row.endOdometer,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
