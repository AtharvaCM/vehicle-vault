import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FuelType,
  VehicleCreateSchema,
  VehicleType,
  type CreateVehicleInput,
} from '@vehicle-vault/shared';

import { createResourceId } from '../../common/utils/create-resource-id.util';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { VehicleRecord } from './types/vehicle-record.type';

@Injectable()
export class VehiclesService {
  private readonly vehicles: VehicleRecord[] = [
    {
      id: 'vehicle_1',
      registrationNumber: 'MH12AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      year: 2022,
      vehicleType: VehicleType.SUV,
      fuelType: FuelType.Petrol,
      odometer: 18240,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-03-01T09:30:00.000Z',
    },
    {
      id: 'vehicle_2',
      registrationNumber: 'KA03CD4567',
      make: 'Tata',
      model: 'Nexon EV',
      variant: 'Empowered',
      year: 2024,
      vehicleType: VehicleType.SUV,
      fuelType: FuelType.Electric,
      odometer: 6240,
      createdAt: '2026-02-04T08:15:00.000Z',
      updatedAt: '2026-02-21T12:45:00.000Z',
    },
  ];

  listVehicles(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const data = this.vehicles.slice(start, start + limit);

    return {
      data,
      meta: {
        page,
        limit,
        total: this.vehicles.length,
      },
    };
  }

  getVehicleById(vehicleId: string) {
    const vehicle = this.vehicles.find((item) => item.id === vehicleId);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }

    return vehicle;
  }

  ensureVehicleExists(vehicleId: string) {
    return this.getVehicleById(vehicleId);
  }

  createVehicle(payload: CreateVehicleDto) {
    const input = this.validateCreateVehicleInput(payload);
    const now = new Date().toISOString();
    const record: VehicleRecord = {
      id: createResourceId('vehicle'),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.vehicles.unshift(record);

    return record;
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
}
