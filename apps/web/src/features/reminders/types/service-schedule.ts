import type { ReminderType } from '@vehicle-vault/shared';

/** What a suggestion's next due was counted from. */
export interface ServiceScheduleAnchor {
  source: 'record' | 'baseline' | 'tyre_check' | 'now';
  lastDoneOdometer?: number;
  lastDoneDate?: string;
}

export interface ServiceScheduleSuggestion {
  slug: string;
  type: ReminderType;
  title: string;
  notes?: string;
  intervalKm?: number;
  intervalMonths?: number;
  dueOdometer?: number;
  dueDate?: string;
  /** Absent only from an API that predates it. */
  anchor?: ServiceScheduleAnchor;
  alreadyScheduled: boolean;
}
