import type { ReminderType } from '@vehicle-vault/shared';

export interface ServiceScheduleSuggestion {
  slug: string;
  type: ReminderType;
  title: string;
  notes?: string;
  intervalKm?: number;
  intervalMonths?: number;
  dueOdometer?: number;
  dueDate?: string;
  alreadyScheduled: boolean;
}
