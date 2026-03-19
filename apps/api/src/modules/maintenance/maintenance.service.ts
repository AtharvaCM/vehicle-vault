import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MaintenanceRecordCreateSchema,
  MaintenanceRecordUpdateSchema,
  type CreateMaintenanceRecordInput,
  type UpdateMaintenanceRecordInput,
} from '@vehicle-vault/shared';
import { randomUUID } from 'node:crypto';

import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import type { UpdateMaintenanceRecordDto } from './dto/update-maintenance-record.dto';
import type { MaintenanceRecordRecord } from './types/maintenance-record.type';

@Injectable()
export class MaintenanceService {
  private readonly records: MaintenanceRecordRecord[] = [];

  constructor(private readonly vehiclesService: VehiclesService) {}

  getAllRecords() {
    return [...this.records].sort((left, right) => {
      const serviceDateDifference =
        new Date(right.serviceDate).getTime() - new Date(left.serviceDate).getTime();

      if (serviceDateDifference !== 0) {
        return serviceDateDifference;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }

  listForVehicle(vehicleId: string, query: PaginationQueryDto) {
    this.vehiclesService.ensureVehicleExists(vehicleId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const items = this.getAllRecords().filter((record) => record.vehicleId === vehicleId);
    const start = (page - 1) * limit;

    return {
      data: items.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: items.length,
        vehicleId,
      },
    };
  }

  getRecordById(recordId: string) {
    const record = this.records.find((item) => item.id === recordId);

    if (!record) {
      throw new NotFoundException(`Maintenance record ${recordId} was not found`);
    }

    return record;
  }

  createForVehicle(vehicleId: string, payload: CreateMaintenanceRecordDto) {
    this.vehiclesService.ensureVehicleExists(vehicleId);

    const input = this.validateCreateMaintenanceInput({
      ...payload,
      vehicleId,
    });
    const now = new Date().toISOString();
    const record: MaintenanceRecordRecord = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.records.unshift(record);

    return record;
  }

  updateRecord(recordId: string, payload: UpdateMaintenanceRecordDto) {
    const record = this.getRecordById(recordId);
    const input = this.validateUpdateMaintenanceInput(payload);

    Object.assign(record, input, {
      updatedAt: new Date().toISOString(),
    });

    return record;
  }

  deleteRecord(recordId: string) {
    const index = this.records.findIndex((item) => item.id === recordId);

    if (index === -1) {
      throw new NotFoundException(`Maintenance record ${recordId} was not found`);
    }

    const deletedRecord = this.records[index];

    if (!deletedRecord) {
      throw new NotFoundException(`Maintenance record ${recordId} was not found`);
    }

    this.records.splice(index, 1);

    return {
      id: deletedRecord.id,
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
}
