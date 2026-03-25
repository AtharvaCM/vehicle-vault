import { Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { FuelLog } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateFuelLogDto } from './dto/create-fuel-log.dto';
import { UpdateFuelLogDto } from './dto/update-fuel-log.dto';

@Injectable()
export class FuelLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async getFuelLogsByVehicle(userId: string, vehicleId: string) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const logs = await this.prisma.fuelLog.findMany({
      where: {
        vehicleId,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return logs.map((log) => this.toFuelLog(log));
  }

  async getFuelLogById(userId: string, logId: string) {
    const log = await this.prisma.fuelLog.findFirst({
      where: {
        id: logId,
        vehicle: {
          userId,
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Fuel log ${logId} was not found`);
    }

    return this.toFuelLog(log);
  }

  async createFuelLog(userId: string, vehicleId: string, dto: CreateFuelLogDto) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const log = await this.prisma.fuelLog.create({
      data: {
        vehicleId,
        date: new Date(dto.date),
        odometer: dto.odometer,
        quantity: dto.quantity,
        price: dto.price,
        totalCost: dto.totalCost,
        location: dto.location,
        notes: dto.notes,
      },
    });

    return this.toFuelLog(log);
  }

  async createBulkFuelLogs(userId: string, vehicleId: string, dtos: CreateFuelLogDto[]) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    const logs = await this.prisma.fuelLog.createMany({
      data: dtos.map((dto) => ({
        vehicleId,
        date: new Date(dto.date),
        odometer: dto.odometer,
        quantity: dto.quantity,
        price: dto.price,
        totalCost: dto.totalCost,
        location: dto.location,
        notes: dto.notes,
      })),
    });

    return {
      count: logs.count,
    };
  }

  async updateFuelLog(userId: string, logId: string, dto: UpdateFuelLogDto) {
    const log = await this.prisma.fuelLog.findFirst({
      where: {
        id: logId,
        vehicle: {
          userId,
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Fuel log ${logId} was not found`);
    }

    const updatedLog = await this.prisma.fuelLog.update({
      where: {
        id: logId,
      },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        odometer: dto.odometer,
        quantity: dto.quantity,
        price: dto.price,
        totalCost: dto.totalCost,
        location: dto.location,
        notes: dto.notes,
      },
    });

    return this.toFuelLog(updatedLog);
  }

  async deleteFuelLog(userId: string, logId: string) {
    const log = await this.prisma.fuelLog.findFirst({
      where: {
        id: logId,
        vehicle: {
          userId,
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Fuel log ${logId} was not found`);
    }

    await this.prisma.fuelLog.delete({
      where: {
        id: logId,
      },
    });

    return {
      id: logId,
      deleted: true,
    };
  }

  private toFuelLog(log: Prisma.FuelLogUncheckedCreateInput & { 
    id: string; 
    createdAt: Date; 
    updatedAt: Date;
    totalCost: Prisma.Decimal;
    price: Prisma.Decimal;
    date: Date;
  }): FuelLog {
    return {
      id: log.id,
      vehicleId: log.vehicleId,
      date: log.date.toISOString(),
      odometer: log.odometer,
      quantity: log.quantity,
      price: Number(log.price),
      totalCost: Number(log.totalCost),
      location: log.location ?? undefined,
      notes: log.notes ?? undefined,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    };
  }
}
