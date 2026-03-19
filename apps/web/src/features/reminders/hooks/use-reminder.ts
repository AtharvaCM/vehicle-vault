import { useQuery } from '@tanstack/react-query';

import { reminderDetailQueryOptions } from '../api/get-reminder-by-id';

export function useReminder(reminderId: string) {
  return useQuery(reminderDetailQueryOptions(reminderId));
}
