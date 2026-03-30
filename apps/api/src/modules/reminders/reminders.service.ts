import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ReminderCreateSchema,
  ReminderStatus,
  ReminderType,
  ReminderUpdateSchema,
  type Reminder,
  type UpdateReminderInput,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateReminderDto } from './dto/create-reminder.dto';
import type { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import type { UpdateReminderDto } from './dto/update-reminder.dto';

const reminderStatusPriority: Record<ReminderStatus, number> = {
  [ReminderStatus.Upcoming]: 0,
  [ReminderStatus.DueToday]: 1,
  [ReminderStatus.Overdue]: 2,
  [ReminderStatus.Completed]: 3,
};

type ReminderWithVehicle = Prisma.ReminderGetPayload<{
  include: {
    vehicle: {
      select: {
        odometer: true;
      };
    };
  };
}>;

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async getAllReminders(userId: string) {
    const reminders = await this.prisma.reminder.findMany({
      where: {
        vehicle: {
          userId,
        },
      },
      include: {
        vehicle: {
          select: {
            odometer: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reminders
      .map((record) => this.toReminder(record))
      .sort((left, right) => this.compareReminders(left, right));
  }

  async listVehicleReminders(userId: string, vehicleId: string, query: ListRemindersQueryDto) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    return this.getPaginatedReminders(
      {
        vehicleId,
        vehicle: {
          userId,
        },
      },
      query,
      vehicleId,
    );
  }

  async listReminders(userId: string, query: ListRemindersQueryDto) {
    return this.getPaginatedReminders(
      query.vehicleId
        ? {
            vehicleId: query.vehicleId,
            vehicle: {
              userId,
            },
          }
        : {
            vehicle: {
              userId,
            },
          },
      query,
    );
  }

  async getReminderById(userId: string, reminderId: string) {
    const reminder = await this.getStoredReminderById(userId, reminderId);

    return this.toReminder(reminder);
  }

  async createReminder(userId: string, vehicleId: string, payload: CreateReminderDto) {
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const input = this.validateCreateReminderInput({
      ...payload,
      vehicleId,
    });
    const reminder = await this.prisma.reminder.create({
      data: {
        vehicleId,
        title: input.title,
        type: input.type as any,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        dueOdometer: input.dueOdometer,
        notes: input.notes,
        status: this.computeReminderStatus(
          {
            dueDate: input.dueDate,
            dueOdometer: input.dueOdometer,
          },
          vehicle.odometer,
        ),
      },
    });

    return this.getReminderById(userId, reminder.id);
  }

  async updateReminder(userId: string, reminderId: string, payload: UpdateReminderDto) {
    const reminder = await this.getStoredReminderById(userId, reminderId);
    const input = this.validateUpdateReminderInput(payload);
    const dueDate = input.dueDate !== undefined ? input.dueDate : reminder.dueDate?.toISOString();
    const dueOdometer =
      input.dueOdometer !== undefined ? input.dueOdometer : (reminder.dueOdometer ?? undefined);
    const reminderStatus = this.computeReminderStatus(
      {
        dueDate,
        dueOdometer,
        completedAt: reminder.completedAt?.toISOString(),
      },
      reminder.vehicle.odometer,
    );

    await this.prisma.reminder.update({
      where: {
        id: reminderId,
      },
      data: {
        title: input.title,
        type: input.type as any,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        dueOdometer: input.dueOdometer,
        notes: input.notes,
        status: reminderStatus,
      },
    });

    return this.getReminderById(userId, reminderId);
  }

  async completeReminder(userId: string, reminderId: string) {
    await this.getStoredReminderById(userId, reminderId);
    const now = new Date();

    await this.prisma.reminder.update({
      where: {
        id: reminderId,
      },
      data: {
        completedAt: now,
        status: ReminderStatus.Completed,
      },
    });

    return this.getReminderById(userId, reminderId);
  }

  async deleteReminder(userId: string, reminderId: string) {
    await this.getReminderById(userId, reminderId);
    await this.prisma.reminder.delete({
      where: {
        id: reminderId,
      },
    });

    return {
      id: reminderId,
      deleted: true,
    };
  }

  private async getPaginatedReminders(
    where: Prisma.ReminderWhereInput | undefined,
    query: ListRemindersQueryDto,
    vehicleId?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const reminders = await this.prisma.reminder.findMany({
      where,
      include: {
        vehicle: {
          select: {
            odometer: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const computed = reminders.map((record) => this.toReminder(record));
    const filtered = query.status
      ? computed.filter((item) => item.status === query.status)
      : computed;
    const sorted = filtered.sort((left, right) => this.compareReminders(left, right));
    const start = (page - 1) * limit;

    return {
      data: sorted.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: sorted.length,
        ...(vehicleId ? { vehicleId } : {}),
      },
    };
  }

  private async getStoredReminderById(userId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: {
        id: reminderId,
        vehicle: {
          userId,
        },
      },
      include: {
        vehicle: {
          select: {
            odometer: true,
          },
        },
      },
    });

    if (!reminder) {
      throw new NotFoundException(`Reminder ${reminderId} was not found`);
    }

    return reminder;
  }

  private toReminder(reminder: ReminderWithVehicle): Reminder {
    const status = this.computeReminderStatus(
      {
        dueDate: reminder.dueDate?.toISOString(),
        dueOdometer: reminder.dueOdometer ?? undefined,
        completedAt: reminder.completedAt?.toISOString(),
      },
      reminder.vehicle.odometer,
    );

    return {
      id: reminder.id,
      vehicleId: reminder.vehicleId,
      title: reminder.title,
      type: reminder.type as ReminderType,
      dueDate: reminder.dueDate?.toISOString(),
      dueOdometer: reminder.dueOdometer ?? undefined,
      status,
      completedAt: reminder.completedAt?.toISOString(),
      notes: reminder.notes ?? undefined,
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    };
  }

  private computeReminderStatus(
    reminder: {
      dueDate?: string;
      dueOdometer?: number;
      completedAt?: string;
    },
    currentOdometer?: number,
  ) {
    if (reminder.completedAt) {
      return ReminderStatus.Completed;
    }

    const dueDateStatus = reminder.dueDate ? this.getDueDateStatus(reminder.dueDate) : null;
    const dueOdometerStatus =
      reminder.dueOdometer !== undefined && currentOdometer !== undefined
        ? this.getDueOdometerStatus(reminder.dueOdometer, currentOdometer)
        : null;

    return [dueDateStatus, dueOdometerStatus].reduce<ReminderStatus>((current, candidate) => {
      if (!candidate) {
        return current;
      }

      return reminderStatusPriority[candidate] > reminderStatusPriority[current]
        ? candidate
        : current;
    }, ReminderStatus.Upcoming);
  }

  private getDueDateStatus(dueDate: string) {
    const dueDay = this.toUtcDayTimestamp(dueDate);
    const today = this.toUtcDayTimestamp(new Date().toISOString());

    if (dueDay < today) {
      return ReminderStatus.Overdue;
    }

    if (dueDay === today) {
      return ReminderStatus.DueToday;
    }

    return ReminderStatus.Upcoming;
  }

  private getDueOdometerStatus(dueOdometer: number, currentOdometer: number) {
    if (dueOdometer < currentOdometer) {
      return ReminderStatus.Overdue;
    }

    if (dueOdometer === currentOdometer) {
      return ReminderStatus.DueToday;
    }

    return ReminderStatus.Upcoming;
  }

  private toUtcDayTimestamp(value: string) {
    const date = new Date(value);

    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  private compareReminders(left: Reminder, right: Reminder) {
    const statusDifference =
      reminderStatusPriority[right.status] - reminderStatusPriority[left.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const leftDueValue =
      (left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY) ||
      Number.POSITIVE_INFINITY;
    const rightDueValue =
      (right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY) ||
      Number.POSITIVE_INFINITY;

    if (left.status === ReminderStatus.Completed && right.status === ReminderStatus.Completed) {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }

    if (leftDueValue !== rightDueValue) {
      return leftDueValue - rightDueValue;
    }

    const leftOdometer = left.dueOdometer ?? Number.POSITIVE_INFINITY;
    const rightOdometer = right.dueOdometer ?? Number.POSITIVE_INFINITY;

    if (leftOdometer !== rightOdometer) {
      return leftOdometer - rightOdometer;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }

  private validateCreateReminderInput(payload: CreateReminderDto & { vehicleId: string }) {
    const result = ReminderCreateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Reminder payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private validateUpdateReminderInput(payload: UpdateReminderDto): UpdateReminderInput {
    const result = ReminderUpdateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Reminder update payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }
}
