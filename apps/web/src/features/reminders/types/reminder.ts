import type {
  CreateReminderInput,
  Reminder,
  ReminderStatus,
  ReminderType,
  UpdateReminderInput,
} from '@vehicle-vault/shared';

export type { CreateReminderInput, Reminder, ReminderStatus, ReminderType, UpdateReminderInput };

export type CreateReminderBody = Omit<CreateReminderInput, 'vehicleId'>;
