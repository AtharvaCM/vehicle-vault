import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordCreateSchema,
  MaintenanceRecordStatus,
  MaintenanceRecordUpdateSchema,
  MaintenanceSource,
  type CreateMaintenanceRecordInput,
  type MaintenanceLineItem,
  type MaintenanceRecord,
  type UpdateMaintenanceRecordInput,
} from '@vehicle-vault/shared';

import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import type { UpdateMaintenanceRecordDto } from './dto/update-maintenance-record.dto';

const maintenanceRecordInclude = {
  lineItems: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.MaintenanceRecordInclude;

type MaintenanceRecordWithLineItems = Prisma.MaintenanceRecordGetPayload<{
  include: typeof maintenanceRecordInclude;
}>;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async getAllRecords(userId: string) {
    const records = await this.prisma.maintenanceRecord.findMany({
      where: {
        vehicle: {
          userId,
        },
      },
      include: maintenanceRecordInclude,
      orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
    });

    return records.map((record) => this.toMaintenanceRecord(record));
  }

  async listForVehicle(userId: string, vehicleId: string, query: PaginationQueryDto) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const [records, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRecord.findMany({
        where: {
          vehicleId,
        },
        include: maintenanceRecordInclude,
        skip: start,
        take: limit,
        orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.maintenanceRecord.count({
        where: {
          vehicleId,
        },
      }),
    ]);

    return {
      data: records.map((record) => this.toMaintenanceRecord(record)),
      meta: {
        page,
        limit,
        total,
        vehicleId,
      },
    };
  }

  async getRecordById(userId: string, recordId: string) {
    return this.toMaintenanceRecord(await this.getOwnedMaintenanceRecord(userId, recordId));
  }

  async createForVehicle(userId: string, vehicleId: string, payload: CreateMaintenanceRecordDto) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const input = this.validateCreateMaintenanceInput({
      ...payload,
      vehicleId,
    });
    const record = await this.prisma.maintenanceRecord.create({
      data: this.toCreateMaintenanceData(input),
      include: maintenanceRecordInclude,
    });

    return this.toMaintenanceRecord(record);
  }

  async createDraftForVehicle(userId: string, vehicleId: string) {
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const record = await this.prisma.maintenanceRecord.create({
      data: {
        vehicleId,
        category: MaintenanceCategory.Other,
        serviceDate: new Date(),
        odometer: vehicle.odometer,
        currencyCode: 'INR',
        source: MaintenanceSource.Ocr,
        status: MaintenanceRecordStatus.Draft,
        totalCost: 0,
      },
      include: maintenanceRecordInclude,
    });

    return this.toMaintenanceRecord(record);
  }

  async createBulkForVehicle(
    userId: string,
    vehicleId: string,
    payloads: CreateMaintenanceRecordDto[],
  ) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    if (!payloads.length) {
      throw new BadRequestException('Add at least one maintenance record to import.');
    }

    const inputs = payloads.map((payload) =>
      this.validateCreateMaintenanceInput({
        ...payload,
        vehicleId,
      }),
    );

    await this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.maintenanceRecord.create({
          data: this.toCreateMaintenanceData(input),
        }),
      ),
    );

    return {
      count: inputs.length,
    };
  }

  async updateRecord(userId: string, recordId: string, payload: UpdateMaintenanceRecordDto) {
    await this.getOwnedMaintenanceRecord(userId, recordId);
    const input = this.validateUpdateMaintenanceInput(payload);
    const record = await this.prisma.maintenanceRecord.update({
      where: {
        id: recordId,
      },
      data: this.toUpdateMaintenanceData(input),
      include: maintenanceRecordInclude,
    });

    return this.toMaintenanceRecord(record);
  }

  async deleteRecord(userId: string, recordId: string) {
    const record = await this.prisma.maintenanceRecord.findFirst({
      where: {
        id: recordId,
        vehicle: {
          userId,
        },
      },
      include: {
        attachments: {
          select: {
            fileName: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record ${recordId} was not found`);
    }

    await this.prisma.maintenanceRecord.delete({
      where: {
        id: recordId,
      },
    });

    await Promise.all(
      record.attachments.map((attachment) => this.storageService.deleteObject(attachment.fileName)),
    );

    return {
      id: record.id,
      deleted: true,
    };
  }

  private async getOwnedMaintenanceRecord(userId: string, recordId: string) {
    const record = await this.prisma.maintenanceRecord.findFirst({
      where: {
        id: recordId,
        vehicle: {
          userId,
        },
      },
      include: maintenanceRecordInclude,
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record ${recordId} was not found`);
    }

    return record;
  }

  private validateCreateMaintenanceInput(
    payload: CreateMaintenanceRecordDto & { vehicleId: string },
  ): CreateMaintenanceRecordInput {
    const result = MaintenanceRecordCreateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Maintenance payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private validateUpdateMaintenanceInput(
    payload: UpdateMaintenanceRecordDto,
  ): UpdateMaintenanceRecordInput {
    const result = MaintenanceRecordUpdateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Maintenance update payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private toCreateMaintenanceData(input: CreateMaintenanceRecordInput) {
    return {
      vehicleId: input.vehicleId,
      category: input.category,
      serviceDate: new Date(input.serviceDate),
      odometer: input.odometer,
      workshopName: input.workshopName,
      invoiceNumber: input.invoiceNumber,
      currencyCode: input.currencyCode,
      source: input.source,
      status: input.status,
      totalCost: input.totalCost,
      laborCost: input.laborCost,
      partsCost: input.partsCost,
      fluidsCost: input.fluidsCost,
      taxCost: input.taxCost,
      discountAmount: input.discountAmount,
      notes: input.notes,
      metadata: input.metadata ? this.toJsonValue(input.metadata) : undefined,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : undefined,
      nextDueOdometer: input.nextDueOdometer,
      lineItems:
        input.lineItems !== undefined
          ? {
              create: input.lineItems.map((lineItem, index) =>
                this.toLineItemCreateData(lineItem, lineItem.position ?? index),
              ),
            }
          : undefined,
    };
  }

  private toUpdateMaintenanceData(input: UpdateMaintenanceRecordInput) {
    return {
      category: input.category,
      serviceDate: input.serviceDate ? new Date(input.serviceDate) : undefined,
      odometer: input.odometer,
      workshopName: input.workshopName,
      invoiceNumber: input.invoiceNumber,
      currencyCode: input.currencyCode,
      source: input.source,
      status: input.status,
      totalCost: input.totalCost,
      laborCost: input.laborCost,
      partsCost: input.partsCost,
      fluidsCost: input.fluidsCost,
      taxCost: input.taxCost,
      discountAmount: input.discountAmount,
      notes: input.notes,
      metadata: input.metadata !== undefined ? this.toJsonValue(input.metadata) : undefined,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : undefined,
      nextDueOdometer: input.nextDueOdometer,
      lineItems:
        input.lineItems !== undefined
          ? {
              deleteMany: {},
              ...(input.lineItems.length
                ? {
                    create: input.lineItems.map((lineItem, index) =>
                      this.toLineItemCreateData(lineItem, lineItem.position ?? index),
                    ),
                  }
                : {}),
            }
          : undefined,
    };
  }

  private toLineItemCreateData(
    input: NonNullable<CreateMaintenanceRecordInput['lineItems']>[number],
    position: number,
  ) {
    return {
      kind: input.kind,
      name: input.name,
      normalizedCategory: input.normalizedCategory,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unitPrice,
      lineTotal: input.lineTotal,
      brand: input.brand,
      partNumber: input.partNumber,
      notes: input.notes,
      position,
      metadata: input.metadata ? this.toJsonValue(input.metadata) : undefined,
    };
  }

  private toMaintenanceRecord(record: MaintenanceRecordWithLineItems) {
    return {
      id: record.id,
      vehicleId: record.vehicleId,
      category: record.category as MaintenanceCategory,
      serviceDate: record.serviceDate.toISOString(),
      odometer: record.odometer,
      workshopName: record.workshopName ?? undefined,
      invoiceNumber: record.invoiceNumber ?? undefined,
      currencyCode: record.currencyCode,
      source: record.source as MaintenanceSource,
      status: record.status as MaintenanceRecordStatus,
      totalCost: Number(record.totalCost),
      laborCost: record.laborCost !== null ? Number(record.laborCost) : undefined,
      partsCost: record.partsCost !== null ? Number(record.partsCost) : undefined,
      fluidsCost: record.fluidsCost !== null ? Number(record.fluidsCost) : undefined,
      taxCost: record.taxCost !== null ? Number(record.taxCost) : undefined,
      discountAmount: record.discountAmount !== null ? Number(record.discountAmount) : undefined,
      notes: record.notes ?? undefined,
      metadata: this.fromJsonValue(record.metadata),
      nextDueDate: record.nextDueDate?.toISOString(),
      nextDueOdometer: record.nextDueOdometer ?? undefined,
      lineItems: record.lineItems.map((lineItem) => this.toMaintenanceLineItem(lineItem)),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    } satisfies MaintenanceRecord;
  }

  private toMaintenanceLineItem(
    lineItem: MaintenanceRecordWithLineItems['lineItems'][number],
  ): MaintenanceLineItem {
    return {
      id: lineItem.id,
      maintenanceRecordId: lineItem.maintenanceRecordId,
      kind: lineItem.kind as MaintenanceLineItemKind,
      name: lineItem.name,
      normalizedCategory: lineItem.normalizedCategory as MaintenanceCategory | undefined,
      quantity: lineItem.quantity !== null ? Number(lineItem.quantity) : undefined,
      unit: lineItem.unit ?? undefined,
      unitPrice: lineItem.unitPrice !== null ? Number(lineItem.unitPrice) : undefined,
      lineTotal: lineItem.lineTotal !== null ? Number(lineItem.lineTotal) : undefined,
      brand: lineItem.brand ?? undefined,
      partNumber: lineItem.partNumber ?? undefined,
      notes: lineItem.notes ?? undefined,
      position: lineItem.position,
      metadata: this.fromJsonValue(lineItem.metadata),
      createdAt: lineItem.createdAt.toISOString(),
      updatedAt: lineItem.updatedAt.toISOString(),
    };
  }

  private toJsonValue(value: Record<string, unknown>) {
    return value as Prisma.InputJsonValue;
  }

  private fromJsonValue(value: Prisma.JsonValue | null | undefined) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return undefined;
    }

    return value as Record<string, unknown>;
  }
}
