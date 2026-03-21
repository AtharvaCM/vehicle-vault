import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';

export const reminderSortOptions = [
  'urgency',
  'due-date-asc',
  'due-date-desc',
  'updated-desc',
] as const;

export type ReminderSortOption = (typeof reminderSortOptions)[number];

export type ReminderListSearch = {
  search?: string;
  status?: ReminderStatus | 'all';
  type?: ReminderType | 'all';
  sort?: ReminderSortOption;
};

export const defaultReminderSort: ReminderSortOption = 'urgency';

export function normalizeReminderListSearch(search: Record<string, unknown>): ReminderListSearch {
  const normalizedSearch =
    typeof search.search === 'string' && search.search.trim().length > 0
      ? search.search.trim()
      : undefined;
  const normalizedStatus =
    typeof search.status === 'string' &&
    (search.status === 'all' || Object.values(ReminderStatus).includes(search.status as ReminderStatus))
      ? (search.status as ReminderStatus | 'all')
      : undefined;
  const normalizedType =
    typeof search.type === 'string' &&
    (search.type === 'all' || Object.values(ReminderType).includes(search.type as ReminderType))
      ? (search.type as ReminderType | 'all')
      : undefined;
  const normalizedSort =
    typeof search.sort === 'string' && reminderSortOptions.includes(search.sort as ReminderSortOption)
      ? (search.sort as ReminderSortOption)
      : undefined;

  return {
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    ...(normalizedStatus && normalizedStatus !== 'all' ? { status: normalizedStatus } : {}),
    ...(normalizedType && normalizedType !== 'all' ? { type: normalizedType } : {}),
    ...(normalizedSort && normalizedSort !== defaultReminderSort
      ? { sort: normalizedSort }
      : {}),
  };
}
