import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType, Prisma } from '@prisma/client';
import {
  AccessoryCreateSchema,
  AccessoryUpdateSchema,
  type Accessory,
  type CreateAccessoryInput,
  type UpdateAccessoryInput,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateAccessoryDto } from './dto/create-accessory.dto';
import type { UpdateAccessoryDto } from './dto/update-accessory.dto';

type AccessoryRow = Prisma.AccessoryGetPayload<Record<string, never>>;

const DEFAULT_CURRENCY_CODE = 'INR';

@Injectable()
export class AccessoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly access: VehicleAccessService,
    private readonly auditService: AuditService,
  ) {}

  async listForVehicle(userId: string, vehicleId: string): Promise<Accessory[]> {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const accessories = await this.prisma.accessory.findMany({
      where: { vehicleId },
      // Still-fitted items first, then most recently bought — the list answers
      // "what is on this vehicle" before "what have I bought for it".
      orderBy: [{ removedDate: 'asc' }, { purchaseDate: 'desc' }],
    });

    return accessories.map((accessory) => this.toAccessory(accessory));
  }

  async createForVehicle(
    userId: string,
    vehicleId: string,
    payload: CreateAccessoryDto,
  ): Promise<Accessory> {
    await this.access.assertEditor(userId, vehicleId);
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const input = this.validateCreateAccessoryInput(payload);

    const created = await this.prisma.$transaction(async (tx) => {
      const accessory = await tx.accessory.create({
        data: {
          vehicleId,
          name: input.name,
          brand: input.brand ?? null,
          category: input.category ?? null,
          purchaseDate: new Date(input.purchaseDate),
          cost: new Prisma.Decimal(input.cost),
          currencyCode: input.currencyCode ?? DEFAULT_CURRENCY_CODE,
          fittedDate: input.fittedDate ? new Date(input.fittedDate) : null,
          fittedOdometer: input.fittedOdometer ?? null,
          removedDate: input.removedDate ? new Date(input.removedDate) : null,
          removedOdometer: input.removedOdometer ?? null,
          warrantyExpiresAt: input.warrantyExpiresAt ? new Date(input.warrantyExpiresAt) : null,
          notes: input.notes ?? null,
        },
      });

      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.accessory.created,
        resourceType: AuditResourceType.accessory,
        resourceId: accessory.id,
        after: accessory as unknown as Record<string, unknown>,
      });

      return accessory;
    });

    return this.toAccessory(created);
  }

  async updateAccessory(
    userId: string,
    accessoryId: string,
    payload: UpdateAccessoryDto,
  ): Promise<Accessory> {
    const existing = await this.getOwnedAccessory(userId, accessoryId);
    const input = this.validateUpdateAccessoryInput(payload);

    // A partial update has to distinguish "not sent" from "sent as null": the
    // first leaves the column alone, the second clears it. A bare assignment
    // sends undefined for a clear attempt, which Prisma reads as "unchanged".
    const data: Prisma.AccessoryUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.brand !== undefined ? { brand: input.brand ?? null } : {}),
      ...(input.category !== undefined ? { category: input.category ?? null } : {}),
      ...(input.purchaseDate !== undefined
        ? { purchaseDate: new Date(input.purchaseDate) }
        : {}),
      ...(input.cost !== undefined ? { cost: new Prisma.Decimal(input.cost) } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.fittedDate !== undefined
        ? { fittedDate: input.fittedDate ? new Date(input.fittedDate) : null }
        : {}),
      ...(input.fittedOdometer !== undefined
        ? { fittedOdometer: input.fittedOdometer ?? null }
        : {}),
      ...(input.removedDate !== undefined
        ? { removedDate: input.removedDate ? new Date(input.removedDate) : null }
        : {}),
      ...(input.removedOdometer !== undefined
        ? { removedOdometer: input.removedOdometer ?? null }
        : {}),
      ...(input.warrantyExpiresAt !== undefined
        ? {
            warrantyExpiresAt: input.warrantyExpiresAt
              ? new Date(input.warrantyExpiresAt)
              : null,
          }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const accessory = await tx.accessory.update({ where: { id: existing.id }, data });

      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.accessory.updated,
        resourceType: AuditResourceType.accessory,
        resourceId: accessory.id,
        before: existing as unknown as Record<string, unknown>,
        after: accessory as unknown as Record<string, unknown>,
      });

      return accessory;
    });

    return this.toAccessory(updated);
  }

  async deleteAccessory(userId: string, accessoryId: string): Promise<{ id: string }> {
    const existing = await this.getOwnedAccessory(userId, accessoryId);

    await this.prisma.$transaction(async (tx) => {
      await tx.accessory.delete({ where: { id: existing.id } });

      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.accessory.deleted,
        resourceType: AuditResourceType.accessory,
        resourceId: existing.id,
        before: existing as unknown as Record<string, unknown>,
      });
    });

    return { id: existing.id };
  }

  /**
   * Accessories whose warranty runs out inside the window, for the alert engine.
   * Scoped through vehicle membership rather than Vehicle.userId so shared
   * vehicles are swept too, matching how document expiry is queried.
   */
  async findExpiringWarranties(userId: string, withinDays: number): Promise<AccessoryRow[]> {
    const from = new Date();
    from.setHours(0, 0, 0, 0);

    const until = new Date(from);
    until.setDate(until.getDate() + withinDays);
    until.setHours(23, 59, 59, 999);

    return this.prisma.accessory.findMany({
      where: {
        vehicle: { members: { some: { userId } } },
        warrantyExpiresAt: { gte: from, lte: until },
        // A warranty on something already off the vehicle is not actionable.
        removedDate: null,
      },
      orderBy: { warrantyExpiresAt: 'asc' },
    });
  }

  /**
   * Item routes carry no vehicleId, so ownership is resolved from the row. The
   * membership filter alone would admit viewers, hence the explicit editor gate.
   */
  private async getOwnedAccessory(userId: string, accessoryId: string): Promise<AccessoryRow> {
    const accessory = await this.prisma.accessory.findUnique({ where: { id: accessoryId } });
    if (!accessory) {
      throw new NotFoundException(`Accessory ${accessoryId} was not found`);
    }

    await this.access.assertEditor(userId, accessory.vehicleId);

    return accessory;
  }

  private validateCreateAccessoryInput(payload: CreateAccessoryDto): CreateAccessoryInput {
    const result = AccessoryCreateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Accessory payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private validateUpdateAccessoryInput(payload: UpdateAccessoryDto): UpdateAccessoryInput {
    const result = AccessoryUpdateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Accessory update payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private toAccessory(row: AccessoryRow): Accessory {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      name: row.name,
      brand: row.brand,
      category: row.category,
      purchaseDate: row.purchaseDate.toISOString(),
      cost: Number(row.cost),
      currencyCode: row.currencyCode,
      fittedDate: row.fittedDate?.toISOString() ?? null,
      fittedOdometer: row.fittedOdometer,
      removedDate: row.removedDate?.toISOString() ?? null,
      removedOdometer: row.removedOdometer,
      warrantyExpiresAt: row.warrantyExpiresAt?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
