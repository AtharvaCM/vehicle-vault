import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MaintenanceCategory,
  MaintenanceRecordCreateSchema,
  ReminderType,
  type CreateMaintenanceRecordInput,
} from '@vehicle-vault/shared';

import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { createResourceId } from '../../common/utils/create-resource-id.util';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';
import type { MaintenanceRecord } from './types/maintenance-record.type';

@Injectable()
export class MaintenanceService {
  private readonly records: MaintenanceRecord[] = [
    {
      id: 'maintenance_1',
      vehicleId: 'vehicle_1',
      category: MaintenanceCategory.OilChange,
      serviceDate: '2026-02-14',
      odometer: 17600,
      workshopName: 'City Hyundai Service',
      totalCost: 7800,
      notes: 'Periodic service with oil and filters replaced.',
      reminderType: ReminderType.Date,
      createdAt: '2026-02-14T10:30:00.000Z',
      updatedAt: '2026-02-14T10:30:00.000Z',
    },
    {
      id: 'maintenance_2',
      vehicleId: 'vehicle_1',
      category: MaintenanceCategory.Brakes,
      serviceDate: '2025-11-09',
      odometer: 14800,
      workshopName: 'Brake Point Garage',
      totalCost: 5400,
      notes: 'Front brake pads replaced.',
      createdAt: '2025-11-09T09:00:00.000Z',
      updatedAt: '2025-11-09T09:00:00.000Z',
    },
  ];

  constructor(private readonly vehiclesService: VehiclesService) {}

  listForVehicle(vehicleId: string, query: PaginationQueryDto) {
    this.vehiclesService.ensureVehicleExists(vehicleId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const items = this.records.filter((record) => record.vehicleId === vehicleId);
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

  createForVehicle(vehicleId: string, payload: CreateMaintenanceRecordDto) {
    this.vehiclesService.ensureVehicleExists(vehicleId);

    const input = this.validateCreateMaintenanceInput({
      ...payload,
      vehicleId,
    });
    const now = new Date().toISOString();
    const record: MaintenanceRecord = {
      id: createResourceId('maintenance'),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.records.unshift(record);

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
}
