import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateInsurancePolicySchema,
  UpdateInsurancePolicySchema,
  type CreateInsurancePolicyInput,
  type UpdateInsurancePolicyInput,
} from '@vehicle-vault/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class InsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async listForVehicle(userId: string, vehicleId: string) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    return this.prisma.insurancePolicy.findMany({
      where: { vehicleId },
      orderBy: { endDate: 'desc' },
    });
  }

  async create(userId: string, vehicleId: string, payload: CreateInsurancePolicyInput) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const data = CreateInsurancePolicySchema.parse(payload);

    return this.prisma.insurancePolicy.create({
      data: {
        ...data,
        vehicleId,
      },
    });
  }

  async update(userId: string, id: string, payload: UpdateInsurancePolicyInput) {
    await this.getOwnedPolicy(userId, id);

    const data = UpdateInsurancePolicySchema.parse(payload);

    return this.prisma.insurancePolicy.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    await this.getOwnedPolicy(userId, id);

    return this.prisma.insurancePolicy.delete({
      where: { id },
    });
  }

  private async getOwnedPolicy(userId: string, id: string) {
    const policy = await this.prisma.insurancePolicy.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!policy || policy.vehicle.userId !== userId) {
      throw new NotFoundException('Insurance policy not found');
    }

    return policy;
  }
}
