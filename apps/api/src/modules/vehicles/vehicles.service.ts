import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  VehicleCreateSchema,
  VehicleUpdateSchema,
  type CreateVehicleInput,
  type UpdateVehicleInput,
} from '@vehicle-vault/shared';
import { randomUUID } from 'node:crypto';

import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { VehicleRecord } from './types/vehicle-record.type';

@Injectable()
export class VehiclesService {
  private readonly vehicles: VehicleRecord[] = [];

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
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.vehicles.unshift(record);

    return record;
  }

  updateVehicle(vehicleId: string, payload: UpdateVehicleDto) {
    const vehicle = this.getVehicleById(vehicleId);
    const input = this.validateUpdateVehicleInput(payload);

    Object.assign(vehicle, input, {
      updatedAt: new Date().toISOString(),
    });

    return vehicle;
  }

  deleteVehicle(vehicleId: string) {
    const index = this.vehicles.findIndex((item) => item.id === vehicleId);

    if (index === -1) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }

    const deletedVehicle = this.vehicles[index];

    if (!deletedVehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }

    this.vehicles.splice(index, 1);

    return {
      id: deletedVehicle.id,
      deleted: true,
    };
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
}
