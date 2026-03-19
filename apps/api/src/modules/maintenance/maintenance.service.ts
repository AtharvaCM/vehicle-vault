import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MaintenanceCategory,
  MaintenanceRecordCreateSchema,
  MaintenanceRecordUpdateSchema,
  type CreateMaintenanceRecordInput,
  type MaintenanceRecord,
  type UpdateMaintenanceRecordInput,
} from '@vehicle-vault/shared';

import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { deleteStoredAttachmentFile } from '../attachments/utils/attachment-upload.util';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import type { UpdateMaintenanceRecordDto } from './dto/update-maintenance-record.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async getAllRecords() {
    const records = await this.prisma.maintenanceRecord.findMany({
      orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
    });

    return records.map((record) => this.toMaintenanceRecord(record));
  }

  async listForVehicle(vehicleId: string, query: PaginationQueryDto) {
    await this.vehiclesService.ensureVehicleExists(vehicleId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const [records, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRecord.findMany({
        where: {
          vehicleId,
        },
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

  async getRecordById(recordId: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: {
        id: recordId,
      },
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record ${recordId} was not found`);
    }

    return this.toMaintenanceRecord(record);
  }

  async createForVehicle(vehicleId: string, payload: CreateMaintenanceRecordDto) {
    await this.vehiclesService.ensureVehicleExists(vehicleId);

    const input = this.validateCreateMaintenanceInput({
      ...payload,
      vehicleId,
    });
    const record = await this.prisma.maintenanceRecord.create({
      data: this.toCreateMaintenanceData(input),
    });

    return this.toMaintenanceRecord(record);
  }

  async updateRecord(recordId: string, payload: UpdateMaintenanceRecordDto) {
    await this.getRecordById(recordId);
    const input = this.validateUpdateMaintenanceInput(payload);
    const record = await this.prisma.maintenanceRecord.update({
      where: {
        id: recordId,
      },
      data: this.toUpdateMaintenanceData(input),
    });

    return this.toMaintenanceRecord(record);
  }

  async deleteRecord(recordId: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: {
        id: recordId,
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
      record.attachments.map((attachment) => deleteStoredAttachmentFile(attachment.fileName)),
    );

    return {
      id: record.id,
      deleted: true,
    };
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
      totalCost: input.totalCost,
      notes: input.notes,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : undefined,
      nextDueOdometer: input.nextDueOdometer,
    };
  }

  private toUpdateMaintenanceData(input: UpdateMaintenanceRecordInput) {
    return {
      category: input.category,
      serviceDate: input.serviceDate ? new Date(input.serviceDate) : undefined,
      odometer: input.odometer,
      workshopName: input.workshopName,
      totalCost: input.totalCost,
      notes: input.notes,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : undefined,
      nextDueOdometer: input.nextDueOdometer,
    };
  }

  private toMaintenanceRecord(
    record: Prisma.MaintenanceRecordUncheckedCreateInput &
      Prisma.MaintenanceRecordUncheckedUpdateInput & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        serviceDate: Date;
        totalCost: Prisma.Decimal;
        nextDueDate: Date | null;
      },
  ) {
    return {
      id: record.id,
      vehicleId: record.vehicleId,
      category: record.category as MaintenanceCategory,
      serviceDate: record.serviceDate.toISOString(),
      odometer: record.odometer,
      workshopName: record.workshopName ?? undefined,
      totalCost: Number(record.totalCost),
      notes: record.notes ?? undefined,
      nextDueDate: record.nextDueDate?.toISOString(),
      nextDueOdometer: record.nextDueOdometer ?? undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    } satisfies MaintenanceRecord;
  }
}
