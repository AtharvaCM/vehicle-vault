import { useQuery } from '@tanstack/react-query';

import { remindersQueryOptions } from '../api/get-reminders';

export function useReminders() {
  return useQuery(remindersQueryOptions());
}
