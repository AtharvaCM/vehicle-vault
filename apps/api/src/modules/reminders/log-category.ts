import { MaintenanceCategory, ReminderType } from '@vehicle-vault/shared';

import { SERVICE_SCHEDULE_CATALOG } from './service-schedule-catalog';

/** Reminder types that ask for work on the vehicle, and the category a type alone implies. */
const CATEGORY_FOR_TYPE: Partial<Record<ReminderType, MaintenanceCategory>> = {
  [ReminderType.Service]: MaintenanceCategory.PeriodicService,
  [ReminderType.TyreRotation]: MaintenanceCategory.TyreRotation,
  [ReminderType.Battery]: MaintenanceCategory.Battery,
};

export type LogCategorySubject = {
  type: ReminderType | `${ReminderType}`;
  catalogSlug: string | null;
  /** The category of the service record that set this reminder, when one did. */
  sourceCategory: MaintenanceCategory | `${MaintenanceCategory}` | null;
  /** True while it follows a paper: its Done is the paper's Renew, not a service. */
  followsPaper: boolean;
};

/**
 * The service category a record logged for this reminder takes, or undefined
 * when completing it is not a service at all (a renewal, a check, a custom
 * to-do). Most specific first: the record that set the reminder, then the
 * schedule item it came from, then its type.
 */
export function reminderLogCategory(subject: LogCategorySubject): MaintenanceCategory | undefined {
  if (subject.followsPaper) return undefined;
  const typeCategory = CATEGORY_FOR_TYPE[subject.type as ReminderType];
  if (!typeCategory) return undefined;

  if (subject.sourceCategory) return subject.sourceCategory as MaintenanceCategory;
  if (subject.catalogSlug) {
    const item = SERVICE_SCHEDULE_CATALOG.find((entry) => entry.slug === subject.catalogSlug);
    if (item?.category) return item.category;
  }
  return typeCategory;
}
