import { ReminderType } from '@vehicle-vault/shared';

export type ReminderRecord = {
  id: string;
  vehicleId: string;
  title: string;
  dueDate: string;
  reminderType: ReminderType;
  status: 'due-soon' | 'overdue';
};
