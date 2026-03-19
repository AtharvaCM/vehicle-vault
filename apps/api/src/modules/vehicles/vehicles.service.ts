import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { deleteStoredAttachmentFile } from '../attachments/utils/attachment-upload.util';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllVehicles() {
    const vehicles = await this.prisma.vehicle.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return vehicles.map((vehicle) => this.toVehicle(vehicle));
  }

  async listVehicles(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const [vehicles, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        skip: start,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.vehicle.count(),
    ]);

    return {
      data: vehicles.map((vehicle) => this.toVehicle(vehicle)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getVehicleById(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }

    return this.toVehicle(vehicle);
  }

  async ensureVehicleExists(vehicleId: string) {
    return this.getVehicleById(vehicleId);
  }

  async createVehicle(payload: CreateVehicleDto) {
    const input = this.validateCreateVehicleInput(payload);
    const vehicle = await this.prisma.vehicle.create({
      data: input,
    });

    return this.toVehicle(vehicle);
  }

  async updateVehicle(vehicleId: string, payload: UpdateVehicleDto) {
    await this.getVehicleById(vehicleId);
    const input = this.validateUpdateVehicleInput(payload);
    const vehicle = await this.prisma.vehicle.update({
      where: {
        id: vehicleId,
      },
      data: input,
    });

    return this.toVehicle(vehicle);
  }

  async deleteVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
      include: {
        maintenanceRecords: {
          select: {
            attachments: {
              select: {
                fileName: true,
              },
            },
          },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }

    await this.prisma.vehicle.delete({
      where: {
        id: vehicleId,
      },
    });

    const attachmentFileNames = vehicle.maintenanceRecords.flatMap((record) =>
      record.attachments.map((attachment) => attachment.fileName),
    );
    await Promise.all(attachmentFileNames.map((fileName) => deleteStoredAttachmentFile(fileName)));

    return {
      id: vehicle.id,
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

  private toVehicle(
    vehicle: Prisma.VehicleUncheckedCreateInput &
      Prisma.VehicleUncheckedUpdateInput & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
      },
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
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
    } satisfies Vehicle;
  }
}
