import { Injectable } from '@nestjs/common';
import type { ComplianceDocument } from '@prisma/client';
import type {
  ComplianceDocumentKind,
  CreateVehicleDocumentInput,
  UpdateVehicleDocumentInput,
  VehicleDocument,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { VehicleDocumentAdapter } from '../types';

/**
 * One adapter per compliance kind (registration, PUC, road tax), all backed
 * by the shared ComplianceDocument table discriminated by `kind`. The three
 * kinds have identical field shapes, so a dedicated table per kind (the
 * insurance/warranty pattern) would triple the schema for no behavioural
 * difference.
 */
abstract class ComplianceAdapter implements VehicleDocumentAdapter {
  abstract readonly kind: ComplianceDocumentKind;

  constructor(protected readonly prisma: PrismaService) {}

  async listForVehicle(vehicleId: string): Promise<VehicleDocument[]> {
    const rows = await this.prisma.complianceDocument.findMany({
      where: { vehicleId, kind: this.kind },
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => this.toDocument(row));
  }

  async findForOwnerCheck(
    id: string,
  ): Promise<{ document: VehicleDocument; vehicleUserId: string } | null> {
    const row = await this.prisma.complianceDocument.findUnique({
      where: { id },
      include: { vehicle: { select: { userId: true } } },
    });
    if (!row || row.kind !== this.kind) return null;
    const { vehicle, ...document } = row;
    return {
      document: this.toDocument(document),
      vehicleUserId: vehicle.userId,
    };
  }

  async activeAt(vehicleId: string, date: Date): Promise<VehicleDocument[]> {
    const rows = await this.prisma.complianceDocument.findMany({
      where: {
        vehicleId,
        kind: this.kind,
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
    // Documents with a null endDate (e.g. lifetime road tax) never expire.
    const rows = await this.prisma.complianceDocument.findMany({
      where: {
        kind: this.kind,
        vehicle: { members: { some: { userId } } },
        endDate: { gte: from, lte: until },
      },
      orderBy: { endDate: 'asc' },
    });
    return rows.map((row) => this.toDocument(row));
  }

  async create(
    vehicleId: string,
    input: Extract<CreateVehicleDocumentInput, { kind: ComplianceDocumentKind }>,
  ): Promise<VehicleDocument> {
    const row = await this.prisma.complianceDocument.create({
      data: {
        vehicleId,
        kind: this.kind,
        provider: input.provider,
        number: input.number ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        amount: input.amount ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.toDocument(row);
  }

  async update(
    id: string,
    input: Extract<UpdateVehicleDocumentInput, { kind: ComplianceDocumentKind }>,
  ): Promise<VehicleDocument> {
    const { kind: _kind, ...data } = input;
    void _kind;
    const row = await this.prisma.complianceDocument.update({
      where: { id },
      data,
    });
    return this.toDocument(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.complianceDocument.delete({ where: { id } });
  }

  toDocument(row: ComplianceDocument): VehicleDocument {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      kind: row.kind,
      provider: row.provider,
      number: row.number,
      startDate: row.startDate,
      endDate: row.endDate,
      notes: row.notes,
      details: {
        amount: row.amount === null ? null : Number(row.amount),
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

@Injectable()
export class RegistrationAdapter extends ComplianceAdapter {
  readonly kind = 'registration' as const;
}

@Injectable()
export class PucAdapter extends ComplianceAdapter {
  readonly kind = 'puc' as const;
}

@Injectable()
export class RoadTaxAdapter extends ComplianceAdapter {
  readonly kind = 'road_tax' as const;
}
