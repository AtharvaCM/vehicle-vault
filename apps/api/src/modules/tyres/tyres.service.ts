import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TyreCreateSchema,
  TyreInspectionCreateSchema,
  TyreUpdateSchema,
  type CreateTyreInput,
  type CreateTyreInspectionInput,
  type Tyre,
  type TyreInspection,
  type TyrePosition,
  type UpdateTyreInput,
  type VehicleTyreCondition,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { TyreConditionResolver } from './tyre-condition.resolver';
import type { CreateTyreDto } from './dto/create-tyre.dto';
import type { CreateTyreInspectionDto } from './dto/create-tyre-inspection.dto';
import type { UpdateTyreDto } from './dto/update-tyre.dto';

type TyreRow = Prisma.TyreGetPayload<Record<string, never>>;
type TyreInspectionRow = Prisma.TyreInspectionGetPayload<Record<string, never>>;

/** How many readings feed the wear-rate projection. Older ones reflect a different driving pattern. */
const WEAR_RATE_SAMPLE = 5;

@Injectable()
export class TyresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly access: VehicleAccessService,
    private readonly conditionResolver: TyreConditionResolver,
  ) {}

  async listForVehicle(userId: string, vehicleId: string): Promise<Tyre[]> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const tyres = await this.prisma.tyre.findMany({
      where: { vehicleId },
      orderBy: [{ removedDate: 'asc' }, { position: 'asc' }, { fittedDate: 'desc' }],
    });

    return tyres.map((tyre) => this.toTyre(tyre));
  }

  async createForVehicle(
    userId: string,
    vehicleId: string,
    payload: CreateTyreDto,
  ): Promise<Tyre> {
    await this.access.assertEditor(userId, vehicleId);
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const input: CreateTyreInput = TyreCreateSchema.parse(payload);

    // Fitting a tyre to an occupied corner retires whatever was there, so a
    // rotation or replacement does not leave two tyres claiming one position.
    const created = await this.prisma.$transaction(async (tx) => {
      if (input.removedDate == null) {
        await tx.tyre.updateMany({
          where: { vehicleId, position: input.position, removedDate: null },
          data: {
            removedDate: new Date(input.fittedDate),
            removedOdometer: input.fittedOdometer,
          },
        });
      }

      return tx.tyre.create({
        data: {
          vehicleId,
          position: input.position,
          brand: input.brand ?? null,
          model: input.model ?? null,
          size: input.size ?? null,
          dotWeek: input.dotWeek ?? null,
          dotYear: input.dotYear ?? null,
          fittedDate: new Date(input.fittedDate),
          fittedOdometer: input.fittedOdometer,
          removedDate: input.removedDate ? new Date(input.removedDate) : null,
          removedOdometer: input.removedOdometer ?? null,
          expectedLifeKm: input.expectedLifeKm ?? null,
          notes: input.notes ?? null,
        },
      });
    });

    return this.toTyre(created);
  }

  async updateTyre(userId: string, tyreId: string, payload: UpdateTyreDto): Promise<Tyre> {
    const existing = await this.getOwnedTyre(userId, tyreId, 'editor');
    const input: UpdateTyreInput = TyreUpdateSchema.parse(payload);

    const updated = await this.prisma.tyre.update({
      where: { id: existing.id },
      data: {
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.brand !== undefined ? { brand: input.brand ?? null } : {}),
        ...(input.model !== undefined ? { model: input.model ?? null } : {}),
        ...(input.size !== undefined ? { size: input.size ?? null } : {}),
        ...(input.dotWeek !== undefined ? { dotWeek: input.dotWeek ?? null } : {}),
        ...(input.dotYear !== undefined ? { dotYear: input.dotYear ?? null } : {}),
        ...(input.fittedDate !== undefined ? { fittedDate: new Date(input.fittedDate) } : {}),
        ...(input.fittedOdometer !== undefined
          ? { fittedOdometer: input.fittedOdometer }
          : {}),
        ...(input.removedDate !== undefined
          ? { removedDate: input.removedDate ? new Date(input.removedDate) : null }
          : {}),
        ...(input.removedOdometer !== undefined
          ? { removedOdometer: input.removedOdometer ?? null }
          : {}),
        ...(input.expectedLifeKm !== undefined
          ? { expectedLifeKm: input.expectedLifeKm ?? null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      },
    });

    return this.toTyre(updated);
  }

  async deleteTyre(userId: string, tyreId: string): Promise<{ id: string }> {
    const existing = await this.getOwnedTyre(userId, tyreId, 'editor');
    await this.prisma.tyre.delete({ where: { id: existing.id } });
    return { id: existing.id };
  }

  async listInspections(userId: string, vehicleId: string): Promise<TyreInspection[]> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const inspections = await this.prisma.tyreInspection.findMany({
      where: { vehicleId },
      orderBy: [{ inspectedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return inspections.map((inspection) => this.toInspection(inspection));
  }

  async createInspection(
    userId: string,
    vehicleId: string,
    payload: CreateTyreInspectionDto,
  ): Promise<TyreInspection> {
    await this.access.assertEditor(userId, vehicleId);
    const input: CreateTyreInspectionInput = TyreInspectionCreateSchema.parse(payload);

    // The tyre must belong to the vehicle in the path, or an inspection could be
    // attached across vehicles.
    const tyre = await this.prisma.tyre.findFirst({
      where: { id: input.tyreId, vehicleId },
    });
    if (!tyre) {
      throw new NotFoundException(`Tyre ${input.tyreId} was not found on this vehicle`);
    }

    const created = await this.prisma.tyreInspection.create({
      data: {
        tyreId: tyre.id,
        vehicleId,
        inspectedAt: new Date(input.inspectedAt),
        odometer: input.odometer,
        treadDepthMm: input.treadDepthMm ?? null,
        pressurePsi: input.pressurePsi ?? null,
        notes: input.notes ?? null,
      },
    });

    return this.toInspection(created);
  }

  /**
   * The measured verdict for a vehicle's currently fitted tyres. Removed tyres
   * are excluded: they say nothing about what the car is running on now.
   */
  async getVehicleCondition(
    userId: string,
    vehicleId: string,
  ): Promise<VehicleTyreCondition> {
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const tyres = await this.prisma.tyre.findMany({
      where: { vehicleId, removedDate: null },
      orderBy: { position: 'asc' },
      include: {
        inspections: {
          orderBy: [{ inspectedAt: 'desc' }, { createdAt: 'desc' }],
          take: WEAR_RATE_SAMPLE,
        },
      },
    });

    const conditions = tyres.map((tyre) =>
      this.conditionResolver.resolve(
        {
          id: tyre.id,
          position: tyre.position as TyrePosition,
          dotWeek: tyre.dotWeek,
          dotYear: tyre.dotYear,
          fittedOdometer: tyre.fittedOdometer,
          expectedLifeKm: tyre.expectedLifeKm,
          inspections: tyre.inspections.map((inspection) => ({
            inspectedAt: inspection.inspectedAt,
            odometer: inspection.odometer,
            treadDepthMm: this.toNumber(inspection.treadDepthMm),
          })),
        },
        vehicle.odometer,
      ),
    );

    return {
      vehicleId,
      overall: this.conditionResolver.worstLevel(conditions),
      tyres: conditions,
    };
  }

  private async getOwnedTyre(userId: string, tyreId: string, role: 'editor' | 'viewer') {
    const tyre = await this.prisma.tyre.findUnique({ where: { id: tyreId } });
    if (!tyre) {
      throw new NotFoundException(`Tyre ${tyreId} was not found`);
    }

    if (role === 'editor') {
      await this.access.assertEditor(userId, tyre.vehicleId);
    } else {
      await this.vehiclesService.ensureVehicleExists(userId, tyre.vehicleId);
    }

    return tyre;
  }

  private toTyre(row: TyreRow): Tyre {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      position: row.position as TyrePosition,
      brand: row.brand,
      model: row.model,
      size: row.size,
      dotWeek: row.dotWeek,
      dotYear: row.dotYear,
      fittedDate: row.fittedDate.toISOString(),
      fittedOdometer: row.fittedOdometer,
      removedDate: row.removedDate?.toISOString() ?? null,
      removedOdometer: row.removedOdometer,
      expectedLifeKm: row.expectedLifeKm,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInspection(row: TyreInspectionRow): TyreInspection {
    return {
      id: row.id,
      tyreId: row.tyreId,
      vehicleId: row.vehicleId,
      inspectedAt: row.inspectedAt.toISOString(),
      odometer: row.odometer,
      treadDepthMm: this.toNumber(row.treadDepthMm),
      pressurePsi: this.toNumber(row.pressurePsi),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Prisma returns Decimal columns as objects; the wire contract is a plain number. */
  private toNumber(value: Prisma.Decimal | null): number | null {
    return value == null ? null : Number(value);
  }
}
