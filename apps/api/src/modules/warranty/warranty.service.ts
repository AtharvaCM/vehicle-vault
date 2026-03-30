import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateWarrantySchema,
  UpdateWarrantySchema,
  type CreateWarrantyInput,
  type UpdateWarrantyInput,
} from '@vehicle-vault/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class WarrantyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async listForVehicle(userId: string, vehicleId: string) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    return this.prisma.warranty.findMany({
      where: { vehicleId },
      orderBy: { startDate: 'desc' },
    });
  }

  async create(userId: string, vehicleId: string, payload: CreateWarrantyInput) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const data = CreateWarrantySchema.parse(payload);

    return this.prisma.warranty.create({
      data: {
        ...data,
        vehicleId,
      },
    });
  }

  async update(userId: string, id: string, payload: UpdateWarrantyInput) {
    await this.getOwnedWarranty(userId, id);

    const data = UpdateWarrantySchema.parse(payload);

    return this.prisma.warranty.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    await this.getOwnedWarranty(userId, id);

    return this.prisma.warranty.delete({
      where: { id },
    });
  }

  private async getOwnedWarranty(userId: string, id: string) {
    const warranty = await this.prisma.warranty.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!warranty || warranty.vehicle.userId !== userId) {
      throw new NotFoundException('Warranty not found');
    }

    return warranty;
  }
}
