import { Injectable } from '@nestjs/common';
import { ReminderType } from '@vehicle-vault/shared';

import type { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import type { ReminderRecord } from './types/reminder-record.type';

@Injectable()
export class RemindersService {
  private readonly reminders: ReminderRecord[] = [
    {
      id: 'reminder_1',
      vehicleId: 'vehicle_1',
      title: 'Insurance renewal for MH12AB1234',
      dueDate: '2026-03-26',
      reminderType: ReminderType.Date,
      status: 'due-soon',
    },
    {
      id: 'reminder_2',
      vehicleId: 'vehicle_1',
      title: 'PUC renewal for MH12AB1234',
      dueDate: '2026-03-10',
      reminderType: ReminderType.Inspection,
      status: 'overdue',
    },
  ];

  listReminders(query: ListRemindersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filtered = this.reminders.filter((item) => {
      if (query.vehicleId && item.vehicleId !== query.vehicleId) {
        return false;
      }

      if (query.status && item.status !== query.status) {
        return false;
      }

      return true;
    });
    const start = (page - 1) * limit;

    return {
      data: filtered.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: filtered.length,
      },
    };
  }
}
