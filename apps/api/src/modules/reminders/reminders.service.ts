import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ReminderCreateSchema,
  ReminderStatus,
  ReminderUpdateSchema,
  type Reminder,
  type UpdateReminderInput,
  type Vehicle,
} from '@vehicle-vault/shared';
import { randomUUID } from 'node:crypto';

import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateReminderDto } from './dto/create-reminder.dto';
import type { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import type { UpdateReminderDto } from './dto/update-reminder.dto';
import type { ReminderRecord } from './types/reminder-record.type';

const reminderStatusPriority: Record<ReminderStatus, number> = {
  [ReminderStatus.Upcoming]: 0,
  [ReminderStatus.DueToday]: 1,
  [ReminderStatus.Overdue]: 2,
  [ReminderStatus.Completed]: 3,
};

@Injectable()
export class RemindersService {
  private readonly reminders: ReminderRecord[] = [];

  constructor(private readonly vehiclesService: VehiclesService) {}

  getAllReminders() {
    return [...this.reminders]
      .map((record) => this.withComputedStatus(record))
      .sort((left, right) => this.compareReminders(left, right));
  }

  listVehicleReminders(vehicleId: string, query: ListRemindersQueryDto) {
    this.vehiclesService.ensureVehicleExists(vehicleId);

    const filtered = this.getPaginatedReminders(
      this.reminders.filter((item) => item.vehicleId === vehicleId),
      query,
    );

    return {
      data: filtered.data,
      meta: {
        ...filtered.meta,
        vehicleId,
      },
    };
  }

  listReminders(query: ListRemindersQueryDto) {
    return this.getPaginatedReminders(
      query.vehicleId
        ? this.reminders.filter((item) => item.vehicleId === query.vehicleId)
        : this.reminders,
      query,
    );
  }

  getReminderById(reminderId: string) {
    const reminder = this.reminders.find((item) => item.id === reminderId);

    if (!reminder) {
      throw new NotFoundException(`Reminder ${reminderId} was not found`);
    }

    return this.withComputedStatus(reminder);
  }

  createReminder(vehicleId: string, payload: CreateReminderDto) {
    this.vehiclesService.ensureVehicleExists(vehicleId);

    const input = this.validateCreateReminderInput({
      ...payload,
      vehicleId,
    });
    const now = new Date().toISOString();
    const reminder = this.withComputedStatus({
      id: randomUUID(),
      ...input,
      status: ReminderStatus.Upcoming,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    this.reminders.unshift(reminder);

    return reminder;
  }

  updateReminder(reminderId: string, payload: UpdateReminderDto) {
    const reminder = this.getStoredReminderById(reminderId);
    const input = this.validateUpdateReminderInput(payload);

    Object.assign(reminder, input, {
      updatedAt: new Date().toISOString(),
    });

    const computedReminder = this.withComputedStatus(reminder);
    Object.assign(reminder, computedReminder);

    return reminder;
  }

  completeReminder(reminderId: string) {
    const reminder = this.getStoredReminderById(reminderId);
    const now = new Date().toISOString();

    reminder.completedAt = now;
    reminder.updatedAt = now;
    reminder.status = ReminderStatus.Completed;

    return reminder;
  }

  deleteReminder(reminderId: string) {
    const index = this.reminders.findIndex((item) => item.id === reminderId);

    if (index === -1) {
      throw new NotFoundException(`Reminder ${reminderId} was not found`);
    }

    const deletedReminder = this.reminders[index];

    if (!deletedReminder) {
      throw new NotFoundException(`Reminder ${reminderId} was not found`);
    }

    this.reminders.splice(index, 1);

    return {
      id: deletedReminder.id,
      deleted: true,
    };
  }

  private getPaginatedReminders(records: ReminderRecord[], query: ListRemindersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const computed = records.map((record) => this.withComputedStatus(record));
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
      },
    };
  }

  private getStoredReminderById(reminderId: string) {
    const reminder = this.reminders.find((item) => item.id === reminderId);

    if (!reminder) {
      throw new NotFoundException(`Reminder ${reminderId} was not found`);
    }

    return reminder;
  }

  private withComputedStatus(reminder: ReminderRecord): Reminder {
    const vehicle = this.getVehicleOrNull(reminder.vehicleId);

    if (reminder.completedAt) {
      return {
        ...reminder,
        status: ReminderStatus.Completed,
      };
    }

    const dueDateStatus = reminder.dueDate ? this.getDueDateStatus(reminder.dueDate) : null;
    const dueOdometerStatus =
      reminder.dueOdometer !== undefined && vehicle
        ? this.getDueOdometerStatus(reminder.dueOdometer, vehicle.odometer)
        : null;

    /**
     * If both dueDate and dueOdometer exist, the more urgent status wins.
     * This keeps the reminder aligned to whichever threshold needs attention first.
     */
    const status = [dueDateStatus, dueOdometerStatus].reduce<ReminderStatus>(
      (current, candidate) => {
        if (!candidate) {
          return current;
        }

        return reminderStatusPriority[candidate] > reminderStatusPriority[current]
          ? candidate
          : current;
      },
      ReminderStatus.Upcoming,
    );

    return {
      ...reminder,
      status,
    };
  }

  private getVehicleOrNull(vehicleId: string): Vehicle | null {
    try {
      return this.vehiclesService.getVehicleById(vehicleId);
    } catch {
      return null;
    }
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
