import { Prisma, VehicleRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FuelType,
  VehicleCreateSchema,
  VehicleType,
  VehicleUpdateSchema,
  type CreateVehicleInput,
  type UpdateVehicleInput,
  type Vehicle,
} from '@vehicle-vault/shared';

import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditResourceType } from '@prisma/client';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleAccessService } from './vehicle-access.service';
import { VehicleCatalogLinkerService } from './vehicle-catalog-linker.service';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
    private readonly auditService: AuditService,
    private readonly access: VehicleAccessService,
    private readonly catalogLinker: VehicleCatalogLinkerService,
  ) {}

  async getAllVehicles(userId: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { members: { some: { userId } } },
      include: { members: { where: { userId }, select: { role: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    return vehicles.map(({ members, ...vehicle }) =>
      this.toVehicle(vehicle, members?.[0]?.role ?? null),
    );
  }

  async listVehicles(userId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const where: Prisma.VehicleWhereInput = { members: { some: { userId } } };
    const [vehicles, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        include: { members: { where: { userId }, select: { role: true }, take: 1 } },
        skip: start,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      data: vehicles.map(({ members, ...vehicle }) =>
        this.toVehicle(vehicle, members?.[0]?.role ?? null),
      ),
      meta: { page, limit, total },
    };
  }

  async getVehicleById(userId: string, vehicleId: string) {
    const role = await this.access.assert(userId, vehicleId, VehicleRole.viewer);
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }
    return this.toVehicle(vehicle, role);
  }

  async ensureVehicleExists(userId: string, vehicleId: string) {
    return this.getVehicleById(userId, vehicleId);
  }

  async createVehicle(userId: string, payload: CreateVehicleDto) {
    const input = this.validateCreateVehicleInput(payload);

    // Auto-link to catalog when caller did not supply catalogVariantId.
    let catalogVariantId: string | null | undefined = input.catalogVariantId;
    let catalogGenerationId: string | null | undefined;
    if (!catalogVariantId) {
      const resolved = await this.catalogLinker.resolveCatalogLink({
        make: input.make,
        model: input.model,
        year: input.year,
        vehicleType: input.vehicleType,
        fuelType: input.fuelType,
      });
      catalogVariantId = resolved.variantId ?? undefined;
      catalogGenerationId = resolved.generationId ?? undefined;
    }

    try {
      const vehicle = await this.prisma.$transaction(async (tx) => {
        const created = await tx.vehicle.create({
          data: {
            userId,
            ...input,
            catalogVariantId,
            catalogGenerationId,
            purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
            purchasePrice: input.purchasePrice ?? null,
            purchaseOdometer: input.purchaseOdometer ?? null,
            members: {
              create: { userId, role: VehicleRole.owner },
            },
          },
        });
        await this.auditService.track(tx, {
          actorUserId: userId,
          ownerUserId: userId,
          action: AUDIT_ACTIONS.vehicle.created,
          resourceType: AuditResourceType.vehicle,
          resourceId: created.id,
          before: null,
          after: created as unknown as Record<string, unknown>,
        });
        return created;
      });

      return this.toVehicle(vehicle, VehicleRole.owner);
    } catch (error) {
      this.handleVehicleConstraintError(error);
      throw error;
    }
  }

  async updateVehicle(userId: string, vehicleId: string, payload: UpdateVehicleDto) {
    const role = await this.access.assert(userId, vehicleId, VehicleRole.editor);
    const before = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!before) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }
    const input = this.validateUpdateVehicleInput(payload);

    // Re-link to catalog when identifying fields change and caller did not
    // override catalogVariantId explicitly.
    const willRelink =
      input.catalogVariantId === undefined &&
      (input.make !== undefined ||
        input.model !== undefined ||
        input.year !== undefined ||
        input.fuelType !== undefined ||
        input.vehicleType !== undefined);

    let relinkedVariantId: string | null = null;
    let relinkedGenerationId: string | null = null;
    if (willRelink) {
      const resolved = await this.catalogLinker.resolveCatalogLink({
        make: input.make ?? before.make,
        model: input.model ?? before.model,
        year: input.year ?? before.year,
        vehicleType: input.vehicleType ?? before.vehicleType,
        fuelType: input.fuelType ?? before.fuelType,
      });
      relinkedVariantId = resolved.variantId;
      relinkedGenerationId = resolved.generationId;
    }

    try {
      const { purchaseDate, ...rest } = input;
      const vehicle = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.vehicle.update({
          where: { id: vehicleId },
          data: {
            ...rest,
            ...(purchaseDate !== undefined
              ? { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }
              : {}),
            ...(willRelink
              ? {
                  catalogVariantId: relinkedVariantId,
                  catalogGenerationId: relinkedGenerationId,
                }
              : {}),
          },
        });
        await this.auditService.track(tx, {
          actorUserId: userId,
          ownerUserId: before.userId,
          action: AUDIT_ACTIONS.vehicle.updated,
          resourceType: AuditResourceType.vehicle,
          resourceId: vehicleId,
          before: before as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        });
        return updated;
      });

      return this.toVehicle(vehicle, role);
    } catch (error) {
      this.handleVehicleConstraintError(error);
      throw error;
    }
  }

  async deleteVehicle(userId: string, vehicleId: string) {
    await this.access.assertOwner(userId, vehicleId);

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        maintenanceRecords: {
          select: {
            attachments: {
              select: { fileName: true },
            },
          },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.delete({ where: { id: vehicleId } });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: vehicle.userId,
        action: AUDIT_ACTIONS.vehicle.deleted,
        resourceType: AuditResourceType.vehicle,
        resourceId: vehicleId,
        before: vehicle as unknown as Record<string, unknown>,
        after: null,
      });
    });

    const attachmentFileNames = vehicle.maintenanceRecords.flatMap((record) =>
      record.attachments.map((attachment) => attachment.fileName),
    );

    await Promise.all(
      attachmentFileNames.map((fileName) => this.storageService.deleteObject(fileName)),
    );

    return { id: vehicle.id, deleted: true };
  }

  private handleVehicleConstraintError(error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(
        'A vehicle with this registration number already exists in your account.',
      );
    }
  }

  private validateCreateVehicleInput(payload: CreateVehicleDto): CreateVehicleInput {
    const result = VehicleCreateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Vehicle payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private validateUpdateVehicleInput(payload: UpdateVehicleDto): UpdateVehicleInput {
    const result = VehicleUpdateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Vehicle update payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private toVehicle(
    vehicle: Prisma.VehicleUncheckedCreateInput &
      Prisma.VehicleUncheckedUpdateInput & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        purchaseDate?: Date | null;
        purchasePrice?: Prisma.Decimal | null;
        purchaseOdometer?: number | null;
      },
    currentUserRole: VehicleRole | null = null,
  ) {
    return {
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      year: vehicle.year,
      fuelType: vehicle.fuelType as FuelType,
      odometer: vehicle.odometer,
      vehicleType: vehicle.vehicleType as VehicleType,
      nickname: vehicle.nickname ?? undefined,
      catalogVariantId: vehicle.catalogVariantId ?? undefined,
      purchaseDate: vehicle.purchaseDate ? vehicle.purchaseDate.toISOString() : null,
      purchasePrice:
        vehicle.purchasePrice != null ? Number(vehicle.purchasePrice.toString()) : null,
      purchaseOdometer: vehicle.purchaseOdometer ?? null,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
      ...(currentUserRole ? { currentUserRole } : {}),
    } satisfies Vehicle;
  }
}
